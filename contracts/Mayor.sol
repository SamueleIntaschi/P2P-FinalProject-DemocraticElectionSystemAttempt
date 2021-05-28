// SPDX-License-Identifier: MIT
//pragma solidity 0.8.1;
pragma solidity >=0.6.22 <0.9.0;

contract Mayor {
    
    // Structs, events, and modifiers
    
    // Store refund data
    struct Refund {
        uint soul;
        address symbol;
    }
    
    // Data to manage the confirmation
    struct Conditions {
        uint32 quorum;
        uint32 envelopes_casted;
        uint32 envelopes_opened;
    }
    
    event NewMayor(address _candidate);
    event Sayonara(address _escrow);
    event EnvelopeCast(address _voter);
    event EnvelopeOpen(address _voter, uint _soul, address _symbol);
    
    // Someone can vote as long as the quorum is not reached
    modifier canVote() {
        require(voting_condition.envelopes_casted < voting_condition.quorum, "Cannot vote now, voting quorum has been reached");
        _;   
    }
    
    // Envelopes can be opened only after receiving the quorum
    modifier canOpen() {
        require(voting_condition.envelopes_casted == voting_condition.quorum, "Cannot open an envelope, voting quorum not reached yet");
        _;
    }
    
    // The outcome of the confirmation can be computed as soon as all the casted envelopes have been opened
    modifier canCheckOutcome() {
        require(voting_condition.envelopes_opened == voting_condition.quorum, "Cannot check the winner, need to open all the sent envelopes");
        _;
    }
    
    // State attributes
    
    // Initialization variables
    address payable[] public candidates;
    address payable public escrow;
    
    // Voting phase variables
    uint total_souls = 0;
    mapping(address => bytes32) envelopes;
    mapping(address => uint) candidate_souls;
    mapping(address => uint) candidate_votes;

    Conditions voting_condition;

    // Refund phase variables
    mapping(address => Refund) souls;
    mapping(address => address) candidate_voted;
    address[] voters;

    /// @notice The constructor only initializes internal variables
    /// @param _candidates (address) The address of the mayor candidate
    /// @param _escrow (address) The address of the escrow account
    /// @param _quorum (address) The number of voters required to finalize the confirmation
    constructor(address payable[] memory _candidates, address payable _escrow, uint32 _quorum) public {
        candidates = _candidates;
        escrow = _escrow;
        voting_condition = Conditions({quorum: _quorum, envelopes_casted: 0, envelopes_opened: 0});
    }


    /// @notice Store a received voting envelope
    /// @param _envelope The envelope represented as the keccak256 hash of (sigil, doblon, soul) 
    function cast_envelope(bytes32 _envelope) canVote public {
        
        if(envelopes[msg.sender] == 0x0) // => NEW, update on 17/05/2021
            voting_condition.envelopes_casted++;

        envelopes[msg.sender] = _envelope;
        emit EnvelopeCast(msg.sender);
    }
    
    
    /// @notice Open an envelope and store the vote information
    /// @param _sigil (uint) The secret sigil of a voter
    /// @param _symbol (address) The address of the preferred candidate
    /// @dev The soul is sent as crypto
    /// @dev Need to recompute the hash to validate the envelope previously casted
    function open_envelope(uint _sigil, address _symbol) canOpen public payable {

        require(envelopes[msg.sender] != 0x0, "The sender has not casted any votes");
        // Recompute the hash to check if the two envelopes correspond
        bytes32 _casted_envelope = envelopes[msg.sender];
        bytes32 _sent_envelope = 0x0;
        _sent_envelope = compute_envelope(_sigil, _symbol, msg.value);
        require(_casted_envelope == _sent_envelope, "Sent envelope does not correspond to the one casted");

        // Add the sender of the transaction to the voters
        voters.push(msg.sender);
        // Save the souls sent by the voter, to eventually refund it if necessary
        souls[msg.sender] = Refund(msg.value, _symbol);
        candidate_voted[msg.sender] = _symbol;
        candidate_souls[_symbol] += msg.value;
        candidate_votes[_symbol]++;
        total_souls += msg.value;
        // Increment the number of opened envelopes
        voting_condition.envelopes_opened++;
        // Emit the event
        emit EnvelopeOpen(msg.sender, msg.value, _symbol);
        // Making the following call here produce a further cost (for the mayor_or_sayonara() execution) for the last voting account
        //if (voting_condition.envelopes_opened == voting_condition.envelopes_casted) mayor_or_sayonara();

    }
    
    
    /// @notice Either confirm or kick out the candidate. Refund the electors who voted for the losing outcome
    function mayor_or_sayonara() canCheckOutcome public {

        uint fund = 0;
        bool success = false;

        address payable winner = payable(address(0));
        for (uint i=0; i<candidates.length; i++) {
            if (winner == payable(address(0)) && candidate_souls[candidates[i]] > 0) {
                fund = candidate_souls[candidates[i]];
                candidate_souls[candidates[i]] = 0;
                winner = candidates[i];
            }
            else {
                if ((candidate_souls[candidates[i]] > fund) || 
                  (candidate_souls[candidates[i]] == fund && candidate_votes[candidates[i]] > candidate_votes[winner])) {
                    fund = candidate_souls[candidates[i]];
                    candidate_souls[candidates[i]] = 0;
                    winner = candidates[i];
                }
                /*
                else if (candidate_souls[candidates[i]] == candidate_souls[winner] && 
                  candidate_votes[candidates[i]] > candidate_votes[winner]) {
                    fund = candidate_souls[candidates[i]];
                    candidate_souls[candidates[i]] = 0;
                    winner = candidates[i];
                }
                */
            }
        }
        
        if (winner != payable(address(0))) {
            (success, ) = winner.call{value: fund}("");
            require(success, "Contract execution Failed");
            fund = 0;

            // Refund the losing voters
            for (uint i=0; i<voting_condition.quorum; i++) {
                if (candidate_voted[voters[i]] != winner) {
                    // Update the balance to refund before the transition (for security reasons)
                    fund = souls[voters[i]].soul;
                    souls[voters[i]].soul = 0;
                    (success, ) = payable(voters[i]).call{value: fund}("");
                    require(success, "Contract execution Failed");
                    fund = 0;
                }
            }
            // Emit the event
            emit NewMayor(winner);
        }
        else {
            // Transfer the nay souls collected to the escrow
            fund = total_souls;
            // Update balance before transition to the escrow (for security reasons)
            total_souls = 0;
            (success, ) = escrow.call{value: fund}("");
            require(success, "Contract execution Failed");
            fund = 0;
            // Emit the event
            emit Sayonara(escrow);
        }

        // Destruct the contract (the escrow receives the eventually remaining fund)
        selfdestruct(escrow);

    }
 
 
    /// @notice Compute a voting envelope
    /// @param _sigil (uint) The secret sigil of a voter
    /// @param _symbol (address) The voting preference
    /// @param _soul (uint) The soul associated to the vote
    function compute_envelope(uint _sigil, address _symbol, uint _soul) public pure returns(bytes32) {
        return keccak256(abi.encode(_sigil, _symbol, _soul));
    }
    
}