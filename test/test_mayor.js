const MayorContract = artifacts.require("Mayor"); // ./build/Mayor.json

contract("Testing MayorContract", accounts => {
    // Test the behavior of the contract
    it("Should test the contract behavior", async function() {
        
        var quorum = 5;
        var voters = new Array(quorum);
        var win = false;
        var totalSoul = 0;
        // Fixed random addresses for candidate and escrow
        var candidates = [
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
        ];
        candidateSouls = new Map();
        candidateVotes = new Map();
        for (var i=0; i<candidates.length; i++) {
            candidateSouls.set(candidates[i], 0);
            candidateVotes.set(candidates[i], 0);
        }
        var escrow = "0x0472ec0185ebb8202f3d4ddb0226998889663cf2";
        var gas = 0;
        // Create the contract from an impartial account
        gas = await MayorContract.new.estimateGas(candidates, escrow, quorum, {from: accounts[quorum]});
        console.log("Gas used for contract creation: " + gas);
        const instance = await MayorContract.new(candidates, escrow, quorum, {from: accounts[quorum]});
        // Send envelopes until the quorum is reached
        for (var i=0; i<quorum; i++) {

            // Generate a random number between 0 to 9
            var symbol = Math.floor(Math.random() * 10);
            voters[i] = {
                sigil: i,
                symbol: candidates[symbol],
                // Generate a random number between 100 and 1000
                soul: Math.floor(Math.random() * (1000 - 100) + 100),
                balance: await web3.eth.getBalance(accounts[i]),
                ethUsed: 0
            };

            // Compute the envelope
            gas = await instance.compute_envelope.estimateGas(voters[i].sigil, voters[i].symbol, voters[i].soul, {from: accounts[i]});
            console.log("Gas used to compute an envelope from account " + i + ": " + gas);
            var result = await instance.compute_envelope(voters[i].sigil, voters[i].symbol, voters[i].soul, {from: accounts[i]});

            // Cast the computed envelope
            gas = await instance.cast_envelope.estimateGas(result, {from: accounts[i]});
            console.log("Gas used to cast an envelope from account " + i + ": " + gas);
            var cast_res = await instance.cast_envelope(result, {from: accounts[i]});
            assert.equal(cast_res.logs[0].event, "EnvelopeCast", "Envelopes should be casted");
            const tx = await web3.eth.getTransaction(cast_res.tx);
            const gasPrice = tx.gasPrice;
            voters[i].ethUsed += gas * gasPrice;
            // Update the candidate soul and votes number
            totalSoul += voters[i].soul;
            candidateSouls.set(candidates[symbol], candidateSouls.get(candidates[symbol]) + voters[i].soul);
            candidateVotes.set(candidates[symbol], candidateVotes.get(candidates[symbol]) + 1);
        }

        // Open the envelopes previously sent
        for (var i=0; i<quorum; i++) {
            //Open envelope
            gas = await instance.open_envelope.estimateGas(voters[i].sigil, voters[i].symbol, {value: voters[i].soul, from: accounts[i]});
            console.log("Gas used to open an envelope from account " + i + ": " + gas);
            const open_res = await instance.open_envelope.sendTransaction(voters[i].sigil, voters[i].symbol, {value: voters[i].soul, from: accounts[i]})//await instance.open_envelope(i, doblon, {from: accounts[i]});
            assert.equal(open_res.logs[0].event, "EnvelopeOpen", "Envelopes should be opened");
            const tx = await web3.eth.getTransaction(open_res.tx);
            const gasPrice = tx.gasPrice;
            voters[i].ethUsed += gas * gasPrice;
        }

        //Check the final result: new mayor elected or sayonara my mayor
        gas = await instance.mayor_or_sayonara.estimateGas();
        console.log("Gas used to decide the results of the election: " + gas);
        const final_res = await instance.mayor_or_sayonara({from: accounts[quorum]});

        var winner = "0x0";
        var result = true;
        for (var i=0; i<candidates.length; i++) {
            if (winner == "0x0" && candidateSouls.get(candidates[i])> 0) winner = candidates[i];
            else if ((candidateSouls.get(candidates[i]) > candidateSouls.get(winner) || 
              ((candidateSouls.get(candidates[i]) == candidateSouls.get(winner) && candidateVotes.get(candidates[i]) > candidateVotes.get(winner))))) {
                winner = candidates[i];
            }
        }
        if (winner == "0x0") result = false;

        //TODO: controllare che venga eletto il sindaco giusto o nessuno
        if (result) assert.equal(final_res.logs[0].event, "NewMayor", "Mayor selection should be correct");
        else assert.equal(final_res.logs[0].event, "Sayonara", "Mayor selection should be correct");

        // Check the balance of the accounts
        //const winnerBalance = await web3.eth.getBalance(winner);
        //const escrowBalance = await web3.eth.getBalance(escrow);
        const winnerBalance = Number.parseFloat(await web3.eth.getBalance(winner)).toPrecision(15);
        const escrowBalance = Number.parseFloat(await web3.eth.getBalance(escrow)).toPrecision(15);
        var preciseTotalSoul = Number.parseFloat(totalSoul).toPrecision(15);
        if (result) {
            assert.equal(winnerBalance, candidateSouls.get(winner), "Winner balance should be correct");
            assert.equal(escrowBalance, 0, "Escrow balance should be correct");
        }
        else {
            assert.equal(winnerBalance, 0, "Winner balance should be correct");
            assert.equal(escrowBalance, preciseTotalSoul, "Escrow balance should be correct");
        }
        for (var i=0; i<quorum; i++) {
            /*
            if ((result && voters[i].symbol != winner.address)) {
                // Compute an approximation of the balance
                var expectedBalance = voters[i].balance - voters[i].ethUsed;
                var actualBalance = await web3.eth.getBalance(accounts[i]);
                assert.equal(actualBalance, expectedBalance,"Souls should be correctly refunded");
            }
            */
            if (result && voters[i].symbol != winner) {
                // Compute an approximation of the balance
                var expectedBalance = Number.parseFloat(voters[i].balance - voters[i].ethUsed).toPrecision(15);
                var actualBalance = Number.parseFloat(await web3.eth.getBalance(accounts[i])).toPrecision(15);
                assert.equal(actualBalance, expectedBalance,"Souls should be correctly refunded");
            }
            else if (!result || (result && voters[i].symbol == winner)) {
                var expectedBalance = Number.parseFloat(voters[i].balance - voters[i].ethUsed - voters[i].soul).toPrecision(15);
                var actualBalance = Number.parseFloat(await web3.eth.getBalance(accounts[i])).toPrecision(15);
                assert.equal(actualBalance, expectedBalance,"Souls should be correctly refunded");
            }
        }
    });


    /*
    TODO: adesso la funzione mayor or sayonara viene chiamata da open_envelope stessa, sistemare i test
    */

    
    it("Should test the contract behavior with coalitions", async function() {
        
        var quorum = 5;
        var voters = new Array(quorum);
        var win = false;
        var totalSoul = 0;
        // Fixed random addresses for candidate and escrow
        var candidates = [
            "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
            "0xF076E015a43B8d4510b64CD7302B7a7d127874Fd",
            "0x48A9f868446130A896D73BC84d0447eb3b17bD07",
            "0xf22F913131989234020AfaAb74bE4434F8D996EC",
            "0xFaf9ebB1e5DE09aB161620a612053562f568dE9c",
            "0xCEEDBEAF084AE3A44427E0Cab3171A22dD161106",
            "0x542392b415B3762A95088151e068799f7577a44F",
            "0xc13F2467E44FF13c01a9eF5F1cd9ADc4C5468615",
            "0x8aF2dF23C48259BBD95C84873163d752938A7f32",
            "0xE96AB844BAC663e1924Df3ae2249F03F8d01d975",
            // Coalition address
            accounts[quorum + 1]
        ];
        var candidateSouls = new Map();
        var candidateVotes = new Map();
        var coalitionSouls = 0;
        for (var i=0; i<candidates.length; i++) {
            if (i == candidates.length - 1) {
                // Case coalition
                candidateSouls.set(candidates[i], 0);
                candidateVotes.set(candidates[i], 0);
            }
            else {
                candidateSouls.set(candidates[i], 0);
                candidateVotes.set(candidates[i], 0);
            }
        }
        var escrow = "0x0472ec0185ebb8202f3d4ddb0226998889663cf2";
        var gas = 0;
        // Create the contract from an impartial account
        const instance = await MayorContract.new(candidates, escrow, quorum, {from: accounts[quorum]});

        var components = [];
        // Create a coalition
        for (var i=0; i<3; i++) {
            components.push(candidates[i]);
        }
        coalitionSouls = await web3.eth.getBalance(candidates[candidates.length - 1]);
        var result = await instance.create_coalition(components, {from: candidates[candidates.length - 1]});
        assert.equal(result.logs[0].event, "CoalitionCreate", "Coalition should be created");
        comps = result.logs[0].args._candidates;
        for (var i=0; i<comps.length; i++) {
            assert.equal(components[i], comps[i], "Coalition should be correct");
        }
        assert.equal(result.logs[0].args._coalition_address, candidates[candidates.length - 1], "Coalition should be created");
        // Set the new balance for this account
        gas = result.receipt.gasUsed;
        const tx = await web3.eth.getTransaction(result.tx);
        const gasPrice = tx.gasPrice;
        coalitionSouls -= gas * gasPrice;

        // Send envelopes until the quorum is reached
        for (var i=0; i<quorum; i++) {

            var symbol = "0x0";
            if (i > quorum/4) {
                // Vote the coalition
                symbol = candidates[candidates.length - 1];
            }
            else {
                // Generate a random number between 0 to 9
                symbol = candidates[Math.floor(Math.random() * 10)];
            }

            voters[i] = {
                sigil: i,
                symbol: symbol,
                // Generate a random number between 100 and 1000
                soul: Math.floor(Math.random() * (1000 - 100) + 100),
                balance: await web3.eth.getBalance(accounts[i]),
                ethUsed: 0
            };

            // Compute the envelope
            result = await instance.compute_envelope(voters[i].sigil, voters[i].symbol, voters[i].soul, {from: accounts[i]});

            // Cast the computed envelope
            var cast_res = await instance.cast_envelope(result, {from: accounts[i]});
            assert.equal(cast_res.logs[0].event, "EnvelopeCast", "Envelopes should be casted");
            const tx = await web3.eth.getTransaction(cast_res.tx);
            gas = cast_res.receipt.gasUsed;
            const gasPrice = tx.gasPrice;
            voters[i].ethUsed += gas * gasPrice;
            // Update the candidate soul and votes number
            totalSoul += voters[i].soul;
            candidateSouls.set(symbol, candidateSouls.get(symbol) + voters[i].soul);
            candidateVotes.set(symbol, candidateVotes.get(symbol) + 1);
        }

        // Open the envelopes previously sent
        for (var i=0; i<quorum; i++) {
            //Open envelope
            const open_res = await instance.open_envelope.sendTransaction(voters[i].sigil, voters[i].symbol, {value: voters[i].soul, from: accounts[i]})//await instance.open_envelope(i, doblon, {from: accounts[i]});
            assert.equal(open_res.logs[0].event, "EnvelopeOpen", "Envelopes should be opened");
            gas = open_res.receipt.gasUsed;
            const tx = await web3.eth.getTransaction(open_res.tx);
            const gasPrice = tx.gasPrice;
            voters[i].ethUsed += gas * gasPrice;
        }

        //Check the final result: new mayor elected or sayonara my mayor
        const final_res = await instance.mayor_or_sayonara({from: accounts[quorum]});

        var winner = "0x0";
        var result = true;
        var coalition = candidates[candidates.length - 1];
        var coal_winner = false;
        // Check if the coalition wins the elections
        if (candidateSouls.get(coalition) > totalSoul/3) {
            winner = coalition;
            coal_winner = true;
            coalitionSouls += candidateSouls.get(coalition);
        }
        // Check the other candidates, not the coalition
        else {
            for (var i=0; i<candidates.length - 1; i++) {
                if (winner == "0x0" && candidateSouls.get(candidates[i])> 0) winner = candidates[i];
                else if ((candidateSouls.get(candidates[i]) > candidateSouls.get(winner) || 
                ((candidateSouls.get(candidates[i]) == candidateSouls.get(winner) && candidateVotes.get(candidates[i]) > candidateVotes.get(winner))))) {
                    winner = candidates[i];
                }
            }
        }

        if (winner == "0x0") result = false;

        if (result) {
            assert.equal(final_res.logs[0].event, "NewMayor", "Mayor selection should be correct");
            assert.equal(final_res.logs[0].args._candidate, winner, "Mayor should be correct");
        }
        else assert.equal(final_res.logs[0].event, "Sayonara", "Mayor selection should be correct");

        // Check the balance of the accounts
        const winnerBalance = Number.parseFloat(await web3.eth.getBalance(winner)).toPrecision(15);
        const escrowBalance = Number.parseFloat(await web3.eth.getBalance(escrow)).toPrecision(15);
        coalitionSouls = Number.parseFloat(coalitionSouls).toPrecision(15);
        var preciseTotalSoul = Number.parseFloat(totalSoul).toPrecision(15);
        if (result && coal_winner) {
            assert.equal(winnerBalance, coalitionSouls, "Winner balance should be correct");
            assert.equal(escrowBalance, 0, "Escrow balance should be correct");
        }
        else if (result && !coal_winner) {
            assert.equal(winnerBalance, candidateSouls.get(winner), "Winner balance should be correct");
            assert.equal(escrowBalance, 0, "Escrow balance should be correct");
        }
        else {
            assert.equal(winnerBalance, 0, "Winner balance should be correct");
            assert.equal(escrowBalance, preciseTotalSoul, "Escrow balance should be correct");
        }
        for (var i=0; i<quorum; i++) {
            if (result && voters[i].symbol != winner) {
                // Compute an approximation of the balance
                var expectedBalance = Number.parseFloat(voters[i].balance - voters[i].ethUsed).toPrecision(15);
                var actualBalance = Number.parseFloat(await web3.eth.getBalance(accounts[i])).toPrecision(15);
                assert.equal(actualBalance, expectedBalance,"Souls should be correctly refunded");
            }
            else if (!result || (result && voters[i].symbol == winner)) {
                var expectedBalance = Number.parseFloat(voters[i].balance - voters[i].ethUsed - voters[i].soul).toPrecision(15);
                var actualBalance = Number.parseFloat(await web3.eth.getBalance(accounts[i])).toPrecision(15);
                assert.equal(actualBalance, expectedBalance,"Souls should be correctly refunded");
            }
        }
    });


});