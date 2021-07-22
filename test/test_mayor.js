const MayorContract = artifacts.require("Mayor"); // ./build/Mayor.json

//TODO: sistemare bilancio escrow aggiungendo bilancio inizialeà, come fatto nell'ultimo test

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
        var initialBalances = new Map();
        for (var i=0; i<candidates.length; i++) {
            var b = await web3.eth.getBalance(candidates[i]);
            initialBalances.set(candidates[i], b);
        }
        var envelopesCasted = 0;
        var envelopesOpened = 0;
        candidateSouls = new Map();
        candidateVotes = new Map();
        for (var i=0; i<candidates.length; i++) {
            candidateSouls.set(candidates[i], 0);
            candidateVotes.set(candidates[i], 0);
        }
        var escrow = "0x0472ec0185ebb8202f3d4ddb0226998889663cf2";
        var initialEscrowBalance = await web3.eth.getBalance(escrow);                
        initialEscrowBalance = Number.parseFloat(initialEscrowBalance);
        var gas = 0;
        // Create the contract from an impartial account
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
            var result = await instance.compute_envelope(voters[i].sigil, voters[i].symbol, voters[i].soul, {from: accounts[i]});

            // Cast the computed envelope
            var cast_res = await instance.cast_envelope(result, {from: accounts[i]});
            if (i == quorum - 1) {
                assert.equal(cast_res.logs[0].event, "QuorumReached", "Envelopes should be casted");
            }
            else {
                assert.equal(cast_res.logs[0].event, "EnvelopeCast", "Envelopes should be casted");
            }
            envelopesCasted++;
            const tx = await web3.eth.getTransaction(cast_res.tx);
            const gasPrice = tx.gasPrice;
            gas = cast_res.receipt.gasUsed;
            voters[i].ethUsed += gas * gasPrice;
        }

        // Open the envelopes previously sent
        for (var j=0; j<quorum; j++) {
            //Open envelope
            const open_res = await instance.open_envelope.sendTransaction(voters[j].sigil, voters[j].symbol, {value: voters[j].soul, from: accounts[j]});
            assert.equal(open_res.logs[0].event, "EnvelopeOpen", "Envelopes should be opened");
            envelopesOpened++;
            const tx = await web3.eth.getTransaction(open_res.tx);
            const gasPrice = tx.gasPrice;
            gas = open_res.receipt.gasUsed;
            voters[j].ethUsed += gas * gasPrice;
            symbol = voters[j].symbol;
            // Update the candidate soul and votes number
            totalSoul += voters[j].soul;
            candidateSouls.set(symbol, candidateSouls.get(symbol) + voters[j].soul);
            candidateVotes.set(symbol, candidateVotes.get(symbol) + 1);
            var equalCandidates = 0;
            if (envelopesCasted == envelopesOpened) {
                var winner = "0x0";
                var result = true;
                for (var i=0; i<candidates.length; i++) {
                    if (winner == "0x0" && candidateSouls.get(candidates[i])> 0) winner = candidates[i];
                    // If two candidates get the same soul, the one with more vote win
                    else if ((candidateSouls.get(candidates[i]) > candidateSouls.get(winner) || 
                    ((candidateSouls.get(candidates[i]) == candidateSouls.get(winner) && candidateVotes.get(candidates[i]) > candidateVotes.get(winner))))) {
                        equalCandidates = 0;
                        winner = candidates[i];
                    }
                    // If two candidates have the same soul and the same votes no one wins
                    else if (candidateSouls.get(candidates[i]) == candidateSouls.get(winner) && candidateVotes.get(candidates[i]) == candidateVotes.get(winner)) {
                        equalCandidates++;
                    }
                }
                if (winner == "0x0" || equalCandidates > 0) result = false;

                if (result) {
                    assert.equal(open_res.logs[1].event, "NewMayor", "Mayor selection should be correct");
                    assert.equal(open_res.logs[1].args._candidate, winner, "Mayor should be correct");
                }
                else assert.equal(open_res.logs[1].event, "Sayonara", "Mayor selection should be correct");
            
                var initbalwin = Number.parseFloat(initialBalances.get(winner));
                const winnerBalance = Number.parseFloat(await web3.eth.getBalance(winner)).toPrecision(15);
                const initialWinnerBalance = Number.parseFloat(initialBalances.get(winner)).toPrecision(15);
                const expectedWinnerBalance = Number.parseFloat(candidateSouls.get(winner) + initbalwin).toPrecision(15);
                const escrowBalance = Number.parseFloat(await web3.eth.getBalance(escrow)).toPrecision(15);
                const expectedEscrowBalance = Number.parseFloat(initialEscrowBalance + totalSoul).toPrecision(15);
                if (result) {
                    assert.equal(winnerBalance, expectedWinnerBalance, "Winner balance should be correct");
                    assert.equal(escrowBalance, initialEscrowBalance, "Escrow balance should be correct");
                }
                else {
                    //assert.equal(winnerBalance, initialWinnerBalance, "Winner balance should be correct");
                    assert.equal(escrowBalance, expectedEscrowBalance, "Escrow balance should be correct");
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
            }
        }
    });
    
    
    it("Should test the contract behavior with coalitions", async function() {
        
        var quorum = 5;
        var voters = new Array(quorum);
        var win = false;
        var totalSoul = 0;
        // Fixed random addresses for candidate and escrow
        var initialCandidates = [
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
        // Candidates with coalition included
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
        var initialBalances = new Map();
        for (var i=0; i<candidates.length; i++) {
            var b = await web3.eth.getBalance(candidates[i]);
            initialBalances.set(candidates[i], b);
        }
        var envelopesCasted = 0;
        var envelopesOpened = 0;
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
        var initialEscrowBalance = await web3.eth.getBalance(escrow);
        initialEscrowBalance = Number.parseFloat(initialEscrowBalance);

        var gas = 0;
        // Create the contract from an impartial account
        const instance = await MayorContract.new(initialCandidates, escrow, quorum, {from: accounts[quorum]});

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
            if (i == quorum - 1) {
                assert.equal(cast_res.logs[0].event, "QuorumReached", "Envelopes should be casted");
            }
            else {
                assert.equal(cast_res.logs[0].event, "EnvelopeCast", "Envelopes should be casted");
            }
            envelopesCasted++;
            const tx = await web3.eth.getTransaction(cast_res.tx);
            gas = cast_res.receipt.gasUsed;
            const gasPrice = tx.gasPrice;
            voters[i].ethUsed += gas * gasPrice;
        }

        // Open the envelopes previously sent
        for (var j=0; j<quorum; j++) {
            //Open envelope
            const open_res = await instance.open_envelope.sendTransaction(voters[j].sigil, voters[j].symbol, {value: voters[j].soul, from: accounts[j]})
            assert.equal(open_res.logs[0].event, "EnvelopeOpen", "Envelopes should be opened");
            const tx = await web3.eth.getTransaction(open_res.tx);
            const gasPrice = tx.gasPrice;
            gas = open_res.receipt.gasUsed;
            voters[j].ethUsed += gas * gasPrice;
            envelopesOpened++;
            symbol = voters[j].symbol;
            // Update the candidate soul and votes number
            totalSoul += voters[j].soul;
            candidateSouls.set(symbol, candidateSouls.get(symbol) + voters[j].soul);
            candidateVotes.set(symbol, candidateVotes.get(symbol) + 1);
            if (envelopesCasted == envelopesOpened) {
                var winner = "0x0";
                var result = true;
                var coalition = candidates[candidates.length - 1];
                var coal_winner = false;
                // Check if the coalition wins the elections
                if (candidateSouls.get(coalition) >= totalSoul/3) {
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
                    assert.equal(open_res.logs[1].event, "NewMayor", "Mayor selection should be correct");
                    assert.equal(open_res.logs[1].args._candidate, winner, "Mayor should be correct");
                }
                else assert.equal(open_res.logs[1].event, "Sayonara", "Mayor selection should be correct");

                // Check the balance of the accounts

                var initbalwin = Number.parseFloat(initialBalances.get(winner));
                const winnerBalance = Number.parseFloat(await web3.eth.getBalance(winner)).toPrecision(15);
                const initialWinnerBalance = Number.parseFloat(initialBalances.get(winner)).toPrecision(15);
                const expectedWinnerBalance = Number.parseFloat(candidateSouls.get(winner) + initbalwin).toPrecision(15);
                const escrowBalance = Number.parseFloat(await web3.eth.getBalance(escrow)).toPrecision(15);
                const expectedEscrowBalance = Number.parseFloat(initialEscrowBalance + totalSoul).toPrecision(15);
                initialEscrowBalance = Number.parseFloat(initialEscrowBalance).toPrecision(15);
                coalitionSouls = Number.parseFloat(coalitionSouls).toPrecision(15);
                if (result && coal_winner) {
                    assert.equal(winnerBalance, coalitionSouls, "Winner balance should be correct");
                    assert.equal(escrowBalance, initialEscrowBalance, "Escrow balance should be correct");
                }
                else if (result && !coal_winner) {
                    assert.equal(winnerBalance, expectedWinnerBalance, "Winner balance should be correct");
                    assert.equal(escrowBalance, initialEscrowBalance, "Escrow balance should be correct");
                }
                else {
                    //assert.equal(winnerBalance, initialWinnerBalance, "Winner balance should be correct");
                    assert.equal(escrowBalance, preciseTotalSoul, "Escrow balance should be correct");
                }
                for (var i=0; i<quorum; i++) {
                    // Check the balances of the losing voters
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
            }
        }
    });

    // Test the behavior of the contract
    it("Should test the contract behavior in the case in which there are no winners", async function() {
        
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
        var envelopesCasted = 0;
        var envelopesOpened = 0;
        candidateSouls = new Map();
        candidateVotes = new Map();
        for (var i=0; i<candidates.length; i++) {
            candidateSouls.set(candidates[i], 0);
            candidateVotes.set(candidates[i], 0);
        }
        var escrow = "0x0472ec0185ebb8202f3d4ddb0226998889663cf2";
        var initialEscrowBalance = await web3.eth.getBalance(escrow);
        initialEscrowBalance = Number.parseFloat(initialEscrowBalance);

        var gas = 0;
        // Create the contract from an impartial account
        const instance = await MayorContract.new(candidates, escrow, quorum, {from: accounts[quorum]});
        // Send envelopes until the quorum is reached
        for (var i=0; i<quorum; i++) {

            // Each candidate gets one vote and 10 soul
            var symbol = i;
            voters[i] = {
                sigil: i,
                symbol: candidates[symbol],
                // Generate a random number between 100 and 1000
                soul: 10,
                balance: await web3.eth.getBalance(accounts[i]),
                ethUsed: 0
            };

            // Compute the envelope
            var result = await instance.compute_envelope(voters[i].sigil, voters[i].symbol, voters[i].soul, {from: accounts[i]});

            // Cast the computed envelope
            var cast_res = await instance.cast_envelope(result, {from: accounts[i]});
            if (i == quorum - 1) {
                assert.equal(cast_res.logs[0].event, "QuorumReached", "Envelopes should be casted");
            }
            else {
                assert.equal(cast_res.logs[0].event, "EnvelopeCast", "Envelopes should be casted");
            }            envelopesCasted++;
            const tx = await web3.eth.getTransaction(cast_res.tx);
            const gasPrice = tx.gasPrice;
            gas = cast_res.receipt.gasUsed;
            voters[i].ethUsed += gas * gasPrice;
        }

        // Open the envelopes previously sent
        for (var j=0; j<quorum; j++) {
            //Open envelope
            const open_res = await instance.open_envelope.sendTransaction(voters[j].sigil, voters[j].symbol, {value: voters[j].soul, from: accounts[j]});
            assert.equal(open_res.logs[0].event, "EnvelopeOpen", "Envelopes should be opened");
            envelopesOpened++;
            const tx = await web3.eth.getTransaction(open_res.tx);
            const gasPrice = tx.gasPrice;
            gas = open_res.receipt.gasUsed;
            voters[j].ethUsed += gas * gasPrice;
            symbol = voters[j].symbol;
            // Update the candidate soul and votes number
            totalSoul += voters[j].soul;
            candidateSouls.set(symbol, candidateSouls.get(symbol) + voters[j].soul);
            candidateVotes.set(symbol, candidateVotes.get(symbol) + 1);
            var equalCandidates = 0;
            if (envelopesCasted == envelopesOpened) {
                var winner = "0x0";
                var result = true;
                for (var i=0; i<candidates.length; i++) {
                    if (winner == "0x0" && candidateSouls.get(candidates[i])> 0) winner = candidates[i];
                    // If two candidates get the same soul, the one with more vote win
                    else if ((candidateSouls.get(candidates[i]) > candidateSouls.get(winner) || 
                    ((candidateSouls.get(candidates[i]) == candidateSouls.get(winner) && candidateVotes.get(candidates[i]) > candidateVotes.get(winner))))) {
                        equalCandidates = 0;
                        winner = candidates[i];
                    }
                    // If two candidates have the same soul and the same votes no one wins
                    else if (candidateSouls.get(candidates[i]) == candidateSouls.get(winner) && candidateVotes.get(candidates[i]) == candidateVotes.get(winner)) {
                        equalCandidates++;
                    }
                }

                assert.equal(open_res.logs[1].event, "Sayonara", "Mayor selection should be correct");

                const escrowBalance = Number.parseFloat(await web3.eth.getBalance(escrow)).toPrecision(15);
                const expectedEscrowBalance = Number.parseFloat(initialEscrowBalance + totalSoul).toPrecision(15);
                initialEscrowBalance = Number.parseFloat(initialEscrowBalance).toPrecision(15);
                
                assert.equal(escrowBalance, expectedEscrowBalance, "Escrow balance should be correct");
                
                for (var i=0; i<quorum; i++) {
                    var expectedBalance = Number.parseFloat(voters[i].balance - voters[i].ethUsed - voters[i].soul).toPrecision(15);
                    var actualBalance = Number.parseFloat(await web3.eth.getBalance(accounts[i])).toPrecision(15);
                    assert.equal(actualBalance, expectedBalance,"Souls should be correctly refunded");
                }
            }
        }
    });

    // Test the behavior of the contract
    it("Should test the contract behavior in the case in which there are coalitions but no winners", async function() {
        var quorum = 6;
        var voters = new Array(quorum);
        var win = false;
        var totalSoul = 0;
        // Fixed random addresses for candidate and escrow
        var initialCandidates = [
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
        // Candidates with coalition included
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
            accounts[quorum + 1],
            accounts[quorum + 2]
        ];
        var envelopesCasted = 0;
        var envelopesOpened = 0;
        var candidateSouls = new Map();
        var candidateVotes = new Map();
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
        var initialEscrowBalance = await web3.eth.getBalance(escrow);
        initialEscrowBalance = Number.parseFloat(initialEscrowBalance);
        var gas = 0;
        // Create the contract from an impartial account
        const instance = await MayorContract.new(initialCandidates, escrow, quorum, {from: accounts[quorum]});

        var components = [];

        // Create coalition 0
        for (var i=0; i<3; i++) {
            components.push(candidates[i]);
        }
        coalition0Souls = await web3.eth.getBalance(candidates[candidates.length - 1]);
        var result = await instance.create_coalition(components, {from: candidates[candidates.length - 1]});
        assert.equal(result.logs[0].event, "CoalitionCreate", "Coalition should be created");
        comps = result.logs[0].args._candidates;
        for (var i=0; i<comps.length; i++) {
            assert.equal(components[i], comps[i], "Coalition should be correct");
        }
        assert.equal(result.logs[0].args._coalition_address, candidates[candidates.length - 1], "Coalition should be created");
        // Set the new balance for this account
        gas = result.receipt.gasUsed;
        var tx = await web3.eth.getTransaction(result.tx);
        var gasPrice = tx.gasPrice;
        coalition0Souls -= gas * gasPrice;

        components = [];

        // Create coalition 1
        for (var i=3; i<6; i++) {
            components.push(candidates[i]);
        }
        coalition1Souls = await web3.eth.getBalance(candidates[candidates.length - 2]);
        var result = await instance.create_coalition(components, {from: candidates[candidates.length - 2]});
        assert.equal(result.logs[0].event, "CoalitionCreate", "Coalition should be created");
        comps = result.logs[0].args._candidates;
        for (var i=0; i<comps.length; i++) {
            assert.equal(components[i], comps[i], "Coalition should be correct");
        }
        assert.equal(result.logs[0].args._coalition_address, candidates[candidates.length - 2], "Coalition should be created");
        // Set the new balance for this account
        gas = result.receipt.gasUsed;
        tx = await web3.eth.getTransaction(result.tx);
        gasPrice = tx.gasPrice;
        coalition1Souls -= gas * gasPrice;

        // Send envelopes until the quorum is reached
        for (var i=0; i<quorum; i++) {

            var symbol = "0x0";
            // Quorum should be odd
            if (i >= 0 && i < quorum/2) {
                // Vote the coalition
                symbol = candidates[candidates.length - 1];
            }
            else if (i >= quorum/2 && i < quorum) {
                symbol = candidates[candidates.length - 2];
            }
            else {
                // Generate a random number between 0 to 9
                symbol = candidates[Math.floor(Math.random() * 10)];
            }

            voters[i] = {
                sigil: i,
                symbol: symbol,
                soul: 100,
                balance: await web3.eth.getBalance(accounts[i]),
                ethUsed: 0
            };

            // Compute the envelope
            result = await instance.compute_envelope(voters[i].sigil, voters[i].symbol, voters[i].soul, {from: accounts[i]});

            // Cast the computed envelope
            var cast_res = await instance.cast_envelope(result, {from: accounts[i]});
            if (i == quorum - 1) {
                assert.equal(cast_res.logs[0].event, "QuorumReached", "Envelopes should be casted");
            }
            else {
                assert.equal(cast_res.logs[0].event, "EnvelopeCast", "Envelopes should be casted");
            }            envelopesCasted++;
            const tx = await web3.eth.getTransaction(cast_res.tx);
            gas = cast_res.receipt.gasUsed;
            const gasPrice = tx.gasPrice;
            voters[i].ethUsed += gas * gasPrice;
        }

        // Open the envelopes previously sent
        for (var j=0; j<quorum; j++) {
            //Open envelope
            const open_res = await instance.open_envelope.sendTransaction(voters[j].sigil, voters[j].symbol, {value: voters[j].soul, from: accounts[j]})
            assert.equal(open_res.logs[0].event, "EnvelopeOpen", "Envelopes should be opened");
            const tx = await web3.eth.getTransaction(open_res.tx);
            const gasPrice = tx.gasPrice;
            gas = open_res.receipt.gasUsed;
            voters[j].ethUsed += gas * gasPrice;
            envelopesOpened++;
            symbol = voters[j].symbol;
            // Update the candidate soul and votes number
            totalSoul += voters[j].soul;
            candidateSouls.set(symbol, candidateSouls.get(symbol) + voters[j].soul);
            candidateVotes.set(symbol, candidateVotes.get(symbol) + 1);
            if (envelopesCasted == envelopesOpened) {
                var winner = "0x0";
                var result = true;
                var coalition0 = candidates[candidates.length - 1];
                var coalition1 = candidates[candidates.length - 2];
                // Check if the coalitions have the same soul and bigger than 1/3 of the total soul
                if (candidateSouls.get(coalition0) >= totalSoul/3 && candidateSouls.get(coalition1) >= totalSoul/3 && candidateSouls.get(coalition0) ==candidateSouls.get(coalition1)) {
                    winner = "0x0";
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

                assert.equal(open_res.logs[1].event, "Sayonara", "Mayor selection should be correct");

                // Check the balance of the accounts
                actualEscrowBalance = totalSoul + initialEscrowBalance;
                const escrowBalance = Number.parseFloat(await web3.eth.getBalance(escrow)).toPrecision(15);
                var preciseTotalSoul = Number.parseFloat(actualEscrowBalance).toPrecision(15);
                assert(escrowBalance, preciseTotalSoul, "Escrow balance should be correct");
                for (var i=0; i<quorum; i++) {
                    // Check the balances of the voters
                    var expectedBalance = Number.parseFloat(voters[i].balance - voters[i].ethUsed - voters[i].soul).toPrecision(15);
                    var actualBalance = Number.parseFloat(await web3.eth.getBalance(accounts[i])).toPrecision(15);
                    assert.equal(actualBalance, expectedBalance,"Souls should be correctly refunded");
                }
            }
        } 
        
    });

});
