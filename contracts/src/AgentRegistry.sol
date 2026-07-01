// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Canonical on-chain record linking an agent to its token, sale, avatar, and config hash.
contract AgentRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    error UnknownAgent();
    error AlreadyRegistered();

    struct Agent {
        address creator;
        address token;
        address sale;
        uint256 avatarId;
        bytes32 configHash;
    }

    mapping(uint256 => Agent) public agents; // agentId => Agent

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed creator,
        address token,
        address sale,
        uint256 avatarId,
        bytes32 configHash
    );
    event ConfigHashUpdated(uint256 indexed agentId, bytes32 oldHash, bytes32 newHash);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function register(
        uint256 agentId,
        address creator,
        address token,
        address sale,
        uint256 avatarId,
        bytes32 configHash
    ) external onlyRole(REGISTRAR_ROLE) {
        if (agents[agentId].token != address(0)) revert AlreadyRegistered();
        agents[agentId] = Agent(creator, token, sale, avatarId, configHash);
        emit AgentRegistered(agentId, creator, token, sale, avatarId, configHash);
    }

    function setConfigHash(uint256 agentId, bytes32 newHash) external onlyRole(EXECUTOR_ROLE) {
        Agent storage a = agents[agentId];
        if (a.token == address(0)) revert UnknownAgent();
        bytes32 old = a.configHash;
        a.configHash = newHash;
        emit ConfigHashUpdated(agentId, old, newHash);
    }
}
