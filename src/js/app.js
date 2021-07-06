/*
    to start the application:
    - start ganache and add contract
    - truffle compile
    - truffle migrate
    - metamask
    - npm run dev
*/

/*
TODO: controllare perché non vengono accettati alcuni indirizzi eth 
      controllare funzionamento sistema di voti
      event listeners
*/

App = {
    contracts: {}, // Store contract abstractions
    contract_address: "",
    web3Provider: null, // Web3 provider
    url: 'http://127.0.0.1:7545', // Url for web3
    account: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    accounts: [
        "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
        "0xF076E015a43B8d4510b64CD7302B7a7d127874Fd",
        "0x48A9f868446130A896D73BC84d0447eb3b17bD07",
        "0xf22F913131989234020AfaAb74bE4434F8D996EC",
        "0xFaf9ebB1e5DE09aB161620a612053562f568dE9c",
        "0xCEEDBEAF084AE3A44427E0Cab3171A22dD161106",
        "0x542392b415B3762A95088151e068799f7577a44F",
        "0xc13F2467E44FF13c01a9eF5F1cd9ADc4C5468615",
        "0x8aF2dF23C48259BBD95C84873163d752938A7f32",
        "0xE96AB844BAC663e1924Df3ae2249F03F8d01d975"
    ],
    candidates: new Map(),
    //voters: window.localStorage,
    voters: new Map(),

    init: function() { return App.initWeb3(); },

    initWeb3: function() { /* initialize Web3 */
        if(typeof web3 != 'undefined') { // Check whether exists a provider, e.g Metamask
            App.web3Provider = window.ethereum; // standard since 2/11/18
            //App.web3Provider = new Web3.providers.HttpProvider(App.url);
            web3 = new Web3(App.web3Provider);
            try { // Permission popup
                ethereum.enable().then(async() => { console.log("DApp connected"); });
            }
            catch(error) { console.log(error); }
        } else { // Otherwise, create a new local instance of Web3
            App.web3Provider = new Web3.providers.HttpProvider(App.url); // <==
            web3 = new Web3(App.web3Provider);
        }
        return App.initContract();
    },

    initContract: async function() { /* Upload the contract's */ 
        let networkId = await web3.eth.net.getId();
        console.log('networkId', networkId);

        // Store ETH current account
        web3.eth.getCoinbase(function(err, account) {
            if(err == null) {
                App.account = account;
                console.log(account);
            }
        });
        // Init contracts
        $.getJSON("Mayor.json").done(function(c) {
            App.contracts.Mayor = TruffleContract(c);
            App.contracts.Mayor.setProvider(App.web3Provider);
            return App.listenForEvents();
        });    
    },

    listenForEvents: function() { /* Activate event listeners */
        web3.eth.getBlockNumber(function (error, block) {
            App.contracts["Mayor"].deployed().then(async (instance) => {
                instance.NewMayor().on('data', function (event) {
                    console.log("New Mayor!!!");
                    document.getElementById("vote-form").display = "none";
                    document.getElementById("results").display = "inline";
                    var elem = document.getElementById("winner-announce");
                    elem.innerHTML = event.returnValues._candidate;
                    //App.voters.clear();
                    // If event has parameters: event.returnValues.*paramName*
                });
            });
        });
        return App.render();
    },
    render: function() { /* Render page */
        // Retrieve contract instance
        App.contracts["Mayor"].deployed().then(async(instance) =>{

            //Get the candidates for mayor
            var i = 0;
            var err = false;
            var options = [];
            while (!err) {
                try {
                    let candidate = await instance.candidates(i);
                    console.log(candidate);
                    options.push({
                        text: 'Candidate ' + i,
                        value: candidate,
                        id: "checkbox-candidate-" + i
                    });
                }
                catch (e) {
                    console.log(e);
                    err = true;
                }
                i++;
            }
            var j = 0;
            err = false;
            while (!err) {
                try {
                    let coalition = await instance.coalitions(j);
                    console.log(coalition.coalition_address); 
                    options.push({
                        text: "Coalition " + j,
                        value: coalition.coalition_address,
                        id: "checkbox-candidate-" + i
                    });
                }
                catch (error) {
                    console.log(error);
                    err = true;
                }
                i++;
                j++;
            }
            let optionList = document.getElementById('vote').options;
            let checkboxes = document.getElementById('candidates-list');
            //Add an option for every candidate
            options.forEach(option => {
                //Add candidates to the selection component
                optionList.add(
                    new Option(option.text, option.value, option.selected)
                );
                //Add candidates to the coalition checkbox
                var input = document.createElement("input");
                var label = document.createElement("label");
                input.type = "checkbox";
                input.name = option.text;
                label.innerHTML = option.text;
                input.id = option.id;
                label.htmlFor = option.id;
                input.value = option.value;
                input.innerHTML = option.text;
                label.className = "checkbox-label";
                input.className = "checkbox-input";
                n = document.createElement("br");
                checkboxes.appendChild(input);
                checkboxes.appendChild(label);
                checkboxes.appendChild(n);
            });
        });
    },

    // Call a function of a smart contract

    vote: function(sigil, symbol, soul) {
        App.contracts["Mayor"].deployed().then(async(instance) => {
            
            //The addres must be one in the network
            //const accounts = await web3.eth.getAccounts();
            //var account = accounts[account_number];
            //account_number++;
            //App.voters[name] = address;
            //App.voters["number"] = account_number;
            var elem = document.getElementById("notification");
            const address = document.getElementById("voter-address").value;
            console.log(sigil,symbol,soul);
            try {
                var result = await instance.compute_envelope(sigil, symbol, soul, {from: address});
                result = await instance.cast_envelope(result, {from: address});
                console.log(result);
                if (result.logs[0].event == "EnvelopeCast") {
                    elem.innerHTML = "Vote correctly inserted";
                }
                else {
                    elem.innerHTML = "Vote not inserted";
                }
            }
            catch (error) {
                console.log(error);
                elem.innerHTML = "Vote not inserted";
            }

        });
    },

    openEnvelope: function(sigil, symbol, soul) {
        App.contracts["Mayor"].deployed().then(async(instance) => {

            //var account = App.voters[name];
            const address = document.getElementById("voter-address").value;
            var elem = document.getElementById("notification");
            console.log(address);
            try {
                var result = await instance.open_envelope.sendTransaction(sigil, symbol, {value: soul, from: address});
                console.log(result);
                if (result.logs[0].event == "EnvelopeOpen") {
                    elem.innerHTML = "EnvelopeOpened"
                }
                else {
                    elem.innerHTML = "The quorum is not reached yet";
                }
            }
            catch (error) {
                elem.innerHTML = "The quorum is not reached yet";
                console.log(error);
            }
            
            try {
                var result = await instance.mayor_or_sayonara({from: address});
                if (result.logs[0].event == "NewMayor") {
                    document.getElementById("vote-form").display = "none";
                    document.getElementById("results").display = "inline";
                    var elem = document.getElementById("winner-announce");
                    elem.innerHTML = "New Mayor elected";
                    //App.voters.clear();
                }
                else if (result.logs[0].event == "Sayonara") {

                }
                else {
                    console.log(result);
                }
            }
            catch (error) {
                console.log(error);
            }

        });
    },

    createCoalition: function(coalition_address, candidates) {
        App.contracts["Mayor"].deployed().then(async(instance) => {
            try {
                var elem = document.getElementById("notification");
                var result = await instance.create_coalition(candidates, {from: coalition_address});
                console.log(result);
                if (result.logs[0].event == "CoalitionCreate") {
                    elem.innerHTML = "Coalition Created"
                }
                else {
                    elem.innerHTML = "Coalition not created";
                }
            }
            catch (e) {
                console.log(e);
            }
        });
    }

}

function selection(s) {
    if (s == 0) {
        // Case coalition
        document.getElementById("vote-form").style.display = "none";
        document.getElementById("coalition-form").style.display = "inline";
    }
    else if (s == 1) {
        // Case vote
        document.getElementById("vote-form").style.display = "inline";
        document.getElementById("coalition-form").style.display = "none";
    }
}

function coalition_handler() {
    var candidates = [];
    var address = document.getElementById("coalition-address").value;
    var cbxs = document.getElementsByClassName("checkbox-input");
    for (var i=0; i<cbxs.length; i++) {
        if (cbxs[i].checked) {
            candidates.push(cbxs[i].value);
        }
    }
    
    App.createCoalition(address, candidates);
}

function open_handler() {
    cleanNotification();
    var fname = document.getElementById("voter-fname").value;
    var lname = document.getElementById("voter-lname").value;
    var name = fname + " " + lname;
    var soul = document.getElementById("soul").value;
    var symbol = document.getElementById("vote").value;
    var sigil = document.getElementById("sigil").value;

    App.openEnvelope(sigil, symbol, soul);

}

function vote_handler() {
    cleanNotification();
    var fname = document.getElementById("voter-fname").value;
    var lname = document.getElementById("voter-lname").value;
    var name = fname + " " + lname;
    var symbol = document.getElementById("vote").value;
    /*
    TODO: var soul = prompt("Enter soul to send", "");
    */
    var soul = document.getElementById("soul").value;
    var sigil = document.getElementById("sigil").value;

    App.vote(sigil, symbol, soul);

}

function cleanNotification() {
    var elem = document.getElementById("notification");
    elem.innerHTML = "";
}

// Call init whenever the window loads
$(function() {
    $(window).on('load', function () {
        App.init();
    });
});