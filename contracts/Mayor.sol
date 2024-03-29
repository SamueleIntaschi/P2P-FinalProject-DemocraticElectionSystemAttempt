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

    // Struct that represents a coalition
    struct Coalition {
        address payable[] components;
        address payable coalition_address;
    }
    
    // Events
    event NewMayor(address _candidate);
    event Sayonara(address _escrow);
    event EnvelopeCast(address _voter);
    event QuorumReached(address _voter);
    event EnvelopeOpen(address _voter, uint _soul, address _symbol);
    event CoalitionCreate(address _coalition_address, address payable[] _candidates);
    
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
    Coalition[] public coalitions;
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
        if (envelopes[msg.sender] == 0x0) voting_condition.envelopes_casted++;
        envelopes[msg.sender] = _envelope;
        // Emit a different event when the quorum is reached, to inform the users
        if (voting_condition.envelopes_casted == voting_condition.quorum) emit QuorumReached(msg.sender);
        else emit EnvelopeCast(msg.sender);
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
        // Update the information relative to the election
        candidate_voted[msg.sender] = _symbol;
        candidate_souls[_symbol] += msg.value;
        candidate_votes[_symbol]++;
        // Reset the envelope cast by the voter
        envelopes[msg.sender] = 0x0;
        // Increment the number of total souls
        total_souls += msg.value;
        // Increment the number of opened envelopes
        voting_condition.envelopes_opened++;
        // Emit the event
        emit EnvelopeOpen(msg.sender, msg.value, _symbol);
        // Making the following call here produce a further cost (for the mayor_or_sayonara() execution) for the last voting account
        if (voting_condition.envelopes_opened == voting_condition.envelopes_casted) mayor_or_sayonara();

    }

    /// @notice Create a coalition taking a list of candidates
    /// @param _candidates the candidates who will form a coalition
    function create_coalition(address payable[] memory _candidates) canVote public {
        // Check if the number of candidates is more than one
        require(_candidates.length > 1, "The number of candidates is too small");
        // Check if the address is a candidate
        bool found = false;
        for (uint i=0; i<candidates.length; i++) {
            if (candidates[i] == msg.sender) {
                found = true;
                break;
            } 
        }
        // If the address is not a candidate, check that it is not an existing coalition
        if (!found) {
            for (uint i=0; i<coalitions.length; i++) {
                if (coalitions[i].coalition_address == msg.sender) {
                    found = true;
                    break;
                }
            }
        }
        require(!found, "The creator of a coalition cannot be a candidate or an existing coalition");
        // Check if there are duplicates in the components
        for (uint i=0; i<_candidates.length; i++) {
            found = false;
            uint j = 0;
            while (j < _candidates.length && !found) {
                if (_candidates[j] == _candidates[i] && i != j) {
                    found = true;
                }
                j++;
            }
            require(!found, "An address is a duplicate");
        }
        // Check that all the components are candidates
        for (uint i=0; i<_candidates.length; i++) {
            found = false;
            uint j = 0;
            while (j < candidates.length && !found) {
                if (candidates[j] == _candidates[i]) {
                    found = true;
                }
                j++;
            }
            require(found, "An address is not a candidate");
        }
        address payable c_address = payable(msg.sender);
        Coalition memory coalition = Coalition({components: _candidates, coalition_address: c_address});
        coalitions.push(coalition);
        emit CoalitionCreate(c_address, _candidates);
    }

    /// @notice Returns the coalition at this index
    /// @param index The index of the coalition requested
    function get_coalition(uint index) public view returns(Coalition memory) {
        return coalitions[index];
    }

    /// @notice Return true if the quorum is reached, false otherwise
    function is_quorum_reached() public view returns(bool) {
        if (voting_condition.envelopes_casted == voting_condition.quorum) return true;
        else return false;
    }
    
    
    /// @notice Either confirm or kick out the candidate. Refund the electors who voted for the losing outcome
    function mayor_or_sayonara() canCheckOutcome public {

        uint fund = 0;
        bool success = false;
        // Variables to check if there are more than one candidates or coalitions in a tie
        uint equal_coalitions = 0;
        uint equal_candidates = 0;

        // Address of the winner, if it exits
        address payable winner = payable(address(0));

        for (uint i=0; i<coalitions.length; i++) {
            // If a coalition has more than 1/3 of the total souls, check if a coalition is the winner
            if (candidate_souls[coalitions[i].coalition_address] >= total_souls / 3) {
                // First coalition with more than 1/3 of the total soul
                if (winner == payable(address(0))) {
                    equal_coalitions = 0;
                    fund = candidate_souls[coalitions[i].coalition_address];
                    candidate_souls[candidates[i]] = 0;
                    winner = coalitions[i].coalition_address;
                }
                // A coalition has more souls than the previous ones
                else if (candidate_souls[coalitions[i].coalition_address] > fund)  {
                    equal_coalitions = 0;
                    fund = candidate_souls[coalitions[i].coalition_address];
                    candidate_souls[candidates[i]] = 0;
                    winner = coalitions[i].coalition_address;
                }
                // Case in which a coalition has more than 1/3 of the soul and has the same soul of another coalition, no one wins, all to the escrow
                else if (candidate_souls[coalitions[i].coalition_address] == fund) {
                    // Increment the number of coalition 
                    equal_coalitions++;
                }
            }
        }

        // If coalitions do not win the elections, check in the candidates for a winner
        if (winner == payable(address(0))) {
            for (uint i=0; i<candidates.length; i++) {
                // Case in which the first candidates with more than 0 soul is examinated
                if (winner == payable(address(0)) && candidate_souls[candidates[i]] > 0) {
                    equal_candidates = 0;
                    fund = candidate_souls[candidates[i]];
                    candidate_souls[candidates[i]] = 0;
                    winner = candidates[i];
                }
                // Case in which a candidate has more soul than the others or the same soul but more votes 
                else if ((candidate_souls[candidates[i]] > fund) || 
                  (candidate_souls[candidates[i]] == fund && candidate_votes[candidates[i]] > candidate_votes[winner])) {
                    equal_candidates = 0;
                    fund = candidate_souls[candidates[i]];
                    candidate_souls[candidates[i]] = 0;
                    winner = candidates[i];
                }
                // Case in which there are two candidates with the same soul and the same votes
                else if (candidate_souls[candidates[i]] == fund && candidate_votes[candidates[i]] == candidate_votes[winner]) {
                    // Increment the number of candidates with same soul and votes
                    equal_candidates++;
                }
            }
        }
        
        // Case in which a single winner exists
        if (winner != payable(address(0)) && equal_coalitions == 0 && equal_candidates == 0) {
            // Send the soul that are due to the winner
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
        // Case in which there are more coalitions with the same souls or more candidates with same soul and votes and more soul than the others
        else {
            // Transfer the  souls collected to the escrow
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