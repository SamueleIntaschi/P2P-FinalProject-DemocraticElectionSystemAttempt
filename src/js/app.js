/*
    to start the application:
    - start ganache and add contract
    - truffle compile
    - truffle migrate
    - metamask
    - npm run dev
*/

App = {
    contracts: {}, // Store contract abstractions
    contract_address: "",
    web3Provider: null, // Web3 provider
    url: 'http://127.0.0.1:7545', // Url for web3
    account: "",
    candidates: [],

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
        // When the metamask account changes, change also the App account
        window.ethereum.on('accountsChanged', function (accounts) {
            App.account = accounts[0];
        });    
    },

    listenForEvents: function() { /* Activate event listeners */
        web3.eth.getBlockNumber(function (error, block) {
            App.contracts["Mayor"].deployed().then(async (instance) => {
                instance.NewMayor().on('data', function (event) {
                    console.log("New Mayor!!!");
                    hideAll();
                    document.getElementById("results").style.display = "inline";
                    var elem = document.getElementById("winner-announce");
                    console.log(event);
                    elem.innerHTML = "The winner is: " + event.returnValues[0];
                });
                instance.Sayonara().on('data', function (event) {
                    console.log("Sayonara!!!");
                    hideAll();
                    document.getElementById("results").style.display = "inline";
                    var elem = document.getElementById("winner-announce");
                    console.log(event);
                    elem.innerHTML = "There is not a winner";
                });
                instance.CoalitionCreate().on('data', function (event) {
                    showSelectionNotificationsOnly();
                    let optionList = document.getElementById('vote').options;
                    let coalition_address = event.returnValues[0];
                    let components = event.returnValues[1];
                    let string = "Coalition of candidates: "
                    for (var i=0; i<components.length; i++) {
                        if (i == components.length - 1) {
                            var ind = getIndexOfCandidate(components[i]);
                            string = string + ind;
                        }
                        else {
                            var ind = getIndexOfCandidate(components[i]);
                            string = string + ind + ", ";
                        } 
                    }
                    optionList.add(
                        new Option(string, coalition_address, false)
                    );
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
                    App.candidates.push(candidate);
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
                    let coalition = await instance.get_coalition(j, {from: App.account});
                    console.log(coalition);
                    let string = "Coalition of candidates: "
                    var id = "";
                    for (var z=0; z<coalition.components.length; z++) {
                        if (z == coalition.components.length -1) {
                            let ind = getIndexOfCandidate(coalition.components[z]);
                            string = string + ind;
                            id = "checkbox-coalition-" + i;
                        }
                        else {
                            let ind = getIndexOfCandidate(coalition.components[z]);
                            string = string + ind + ", ";
                            id = "checkbox-coalition-" + i;
                        }
                    } 
                    options.push({
                        text: string,
                        value: coalition.coalition_address,
                        id: id
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
            let optionListOpen = document.getElementById('vote-open').options;
            let checkboxes = document.getElementById('candidates-list');
            //Add an option for every candidate
            options.forEach(option => {
                //Add candidates to the selection components
                optionList.add(
                    new Option(option.text, option.value, option.selected)
                );
                optionListOpen.add(
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

            if (soul != "" && soul >= 0 && sigil != "") {
                //const address = document.getElementById("voter-address").value;
                console.log(sigil,symbol,soul, App.account);
                showSelectionNotificationsOnly();
                try {
                    var result = await instance.compute_envelope(sigil, symbol, soul, {from: App.account});
                    result = await instance.cast_envelope(result, {from: App.account});
                    if (result.logs[0].event == "EnvelopeCast") {
                        notify("Vote correctly inserted", 0);
                    }
                    else {
                        notify("Vote not inserted", 1);
                    }
                }
                
                catch (error) {
                    console.log(error);
                    notify("Vote not inserted", 1);
                }
            }
            else if (!sigil) {
                notify("The sigil can't be empty", 1);
            }
            else if (!soul) {
                notify("The soul can't be empty", 1);
            }
        });
    },

    openEnvelope: function(sigil, symbol, soul) {
        App.contracts["Mayor"].deployed().then(async(instance) => {

            if (soul != "" && soul >= 0 && sigil != "") {
                console.log(sigil,symbol,soul);
                showSelectionNotificationsOnly();
                try {
                    var result = await instance.open_envelope.sendTransaction(sigil, symbol, {value: soul, from: App.account});
                    console.log(result);
                    if (result.logs[0].event == "EnvelopeOpen") {
                        notify("Envelope opened", 0);
                    }
                    else {
                        notify("Envelope not opened", 1);
                    }
                }
                catch (error) {
                    notify("Envelope not opened", 1);
                    console.log(error);
                }
            }
            else if (!sigil) {
                notify("The sigil can't be empty", 1);
            }
            else if (!soul) {
                notify("The soul can't be empty", 1);
            }
        });
    },

    createCoalition: function(candidates) {
        App.contracts["Mayor"].deployed().then(async(instance) => {
            try {
                var result = await instance.create_coalition(candidates, {from: App.account});
                console.log(result);
                showSelectionNotificationsOnly();
                if (result.logs[0].event == "CoalitionCreate") {
                    notify("Coalition Created", 0);
                }
                else {
                    notify("Coalition not created", 1);
                }
            }
            catch (e) {
                console.log(e);
            }
        });
    }

}

function showSelectionNotificationsOnly() {
    hideAll();
    document.getElementById("notification").style.display = "inline";
    var elems = document.getElementsByClassName("selection");
    for (var i=0; i<elems.length; i++) {
        elems[i].style.display = "inline";
    }
}

function hideAll() {
    document.getElementById("notification").style.display = "none";
    var elems = document.getElementsByClassName("selection");
    for (var i=0; i<elems.length; i++) {
        elems[i].style.display = "none";
    }
    elems = document.getElementsByClassName("forms");
    for (var i=0; i<elems.length; i++) {
        elems[i].style.display = "none";
    }
}

function selection(s) {
    if (s == 0) {
        // Case coalition
        hideAll();
        document.getElementById("coalition-form").style.display = "inline";
    }
    else if (s == 1) {
        // Case vote
        hideAll();
        document.getElementById("vote-form").style.display = "inline";
    }
    else if (s == 2) {
        // Case opening
        hideAll();
        document.getElementById("open-form").style.display = "inline";
    }
}

function coalition_handler() {
    cleanNotification();
    var candidates = [];
    var cbxs = document.getElementsByClassName("checkbox-input");
    for (var i=0; i<cbxs.length; i++) {
        if (cbxs[i].checked) {
            candidates.push(cbxs[i].value);
        }
    }
    
    App.createCoalition(candidates);
}

function open_handler() {
    cleanNotification();
    var soul = document.getElementById("open-soul-field").value;
    var symbol = document.getElementById("vote-open").value;
    var sigil = document.getElementById("open-sigil-field").value;

    App.openEnvelope(sigil, symbol, soul);

}

function vote_handler() {
    cleanNotification();
    var symbol = document.getElementById("vote").value;
    /*
    TODO: var soul = prompt("Enter soul to send", "");
    */
    var soul = document.getElementById("soul").value;
    var sigil = document.getElementById("sigil").value;

    App.vote(sigil, symbol, soul);

}

function notify(message, mode) {
    var elem = document.getElementById("notification");
    elem.style.display = "inline";
    if (mode == 0) {
        elem.style.color = "green";
    }
    else if (mode == 1) {
        elem.style.color = "red";
    }
    elem.innerHTML = message;
}

function cleanNotification() {
    var elem = document.getElementById("notification");
    elem.innerHTML = "";
}

function getIndexOfCandidate(candidate) {
    for (var i=0; i<App.candidates.length; i++) {
        if (App.candidates[i] == candidate) return i;
    }
    return -1;
}

function cancel() {
    hideAll();
    var elems = document.getElementsByClassName("selection");
    for (var i=0; i<elems.length; i++) {
        elems[i].style.display = "inline";
    }
}

// Call init whenever the window loads
$(function() {
    $(window).on('load', function () {
        App.init();
    });
});