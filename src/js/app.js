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
    web3Provider: null, // Web3 provider
    url: 'http://127.0.0.1:7545', // Url for web3
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

    init: function() { return App.initWeb3(); },

    initWeb3: function() { /* initialize Web3 */
        if(typeof web3 != 'undefined') { // Check whether exists a provider, e.g Metamask
            //App.web3Provider = window.ethereum; // standard since 2/11/18
            App.web3Provider = new Web3.providers.HttpProvider(App.url);
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
    initContract: function() { /* Upload the contract's */ 
        // Store ETH current account
        web3.eth.getCoinbase(function(err, account) {
            if(err == null) {
                App.account = account;
                console.log(account);
                $("#accountId").html("Your address: " + account);
            }
        });
        // Init contracts
        $.getJSON("Mayor.json").done(function(c) {
            App.contracts["Mayor"] = TruffleContract(c);
            App.contracts["Mayor"].setProvider(App.web3Provider);
            return App.listenForEvents();
        });    
    },
    listenForEvents: function() { /* Activate event listeners */
        web3.eth.getBlockNumber(function (error, block) {
            App.contracts["Mayor"].deployed().then(async (instance) => {
                // click is the Solidity event
                instance.EnvelopeOpen().on('data', function (event) {
                    $("#eventId").html("Event catched!");
                    console.log("Event catched");
                    console.log(event);
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
            var candidates = [];
            var options = [];
            while (!err) {
                try {
                    let candidate = await instance.candidates(i);
                    console.log(candidate);
                    candidates.push(candidate);
                    options.push({
                        text: 'Candidate ' + i,
                        value: candidate
                    });
                }
                catch (e) {
                    console.log(e);
                    err = true;
                }
                i++;
            }
            console.log(candidates);
            let optionList = document.getElementById('vote').options;
            //Add an option for every candidate
            options.forEach(option =>
                optionList.add(
                    new Option(option.text, option.value, option.selected)
                )
            );
        });
    },

    // Call a function of a smart contract
    // The function send an event that triggers a transaction:: Metamask pops up and ask the user to confirm the transaction
    pressClick: function() {
        App.contracts["Contract"].deployed().then(async(instance) =>{
            await instance.pressClick({from: App.account});
        });
    },

    
    computeEnvelope: function() {
        console.log("Called!")
        App.contracts["Mayor"].deployed().then(async(instance) => {
            await instance.compute_envelope("0x0", {from: App.accounts[2]});
        });
    },

    castEnvelope: function(account) {
        App.contracts["Mayor"].deployed().then(async(instance) => {
            await instance.cast_envelope(result, {from: account});
        });
    } 
}

/*
function selection(s) {
    if (s == 0) {
        var el = document.getElementById("candidate-button");
        el.style.display = "none";
        el = document.getElementById("vote-button");
        el.style.display = "none";
        el = document.getElementById("vote-form");
        el.style.display = "none";
        el = document.getElementById("candidate-form");
        el.style.display = "inline";
    }
    else if (s == 1) {
        var el = document.getElementById("candidate-button");
        el.style.display = "none";
        el = document.getElementById("candidate-form");
        el.style.display = "none";
        el = document.getElementById("vote-button");
        el.style.display = "none";
        el = document.getElementById("vote-form");
        el.style.display = "inline";
    }
}

function candidate_handler() {
    //Generate a random address and associate it to the candidate's name
    var fname = document.getElementById("candidate-fname").value;
    var lname = document.getElementById("candidate-lname").value;
    var name = fname + " " + lname;
    var account = web3.eth.accounts.create();
    var address = account.address;
    App.candidates[name] = address;
    console.log("candidate added: " + name);
    //TODO: go to a page that shows the result of the operation or return to homepage
}
*/

function vote_handler() {
    //TODO: calcolare busta e inviare
}

// Call init whenever the window loads
$(function() {
    $(window).on('load', function () {
        App.init();
    });
});