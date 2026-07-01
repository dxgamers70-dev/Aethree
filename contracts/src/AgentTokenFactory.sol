// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AgentRegistry} from "./AgentRegistry.sol";
import {AvatarNFT} from "./AvatarNFT.sol";
import {AgentToken} from "./AgentToken.sol";
import {BondingCurveSale} from "./BondingCurveSale.sol";

/// @notice Launches an agent in one tx: mint avatar, deploy token+sale, seed the
/// bid-wall floor with the creator's AEON, register.
contract AgentTokenFactory {
    using SafeERC20 for IERC20;

    // Curve slope is an economic tuning knob (see spec open params); P0 is derived
    // per-launch from the seed so the day-1 floor equals the start price.
    uint256 public constant SLOPE = 1e12;
    uint256 public constant MAX_SUPPLY = 1_000_000; // whole tokens
    uint256 public constant V = MAX_SUPPLY;         // virtual circulating supply
    uint256 public constant MIN_SEED = 100_000e18;  // 100,000 AEON

    AgentRegistry public immutable registry;
    AvatarNFT public immutable avatars;
    IERC20 public immutable aeon;
    address public immutable treasury;
    address public immutable rhegiPlatform;

    error SeedTooLow();

    event AgentCreated(
        uint256 indexed agentId, address indexed creator, address token, address sale, uint256 seed
    );

    constructor(
        address registry_,
        address avatars_,
        address aeon_,
        address treasury_,
        address rhegiPlatform_
    ) {
        registry = AgentRegistry(registry_);
        avatars = AvatarNFT(avatars_);
        aeon = IERC20(aeon_);
        treasury = treasury_;
        rhegiPlatform = rhegiPlatform_;
    }

    function createAgent(
        string calldata name,
        string calldata symbol,
        string calldata avatarURI,
        bytes32 configHash,
        uint256 seed
    ) external returns (uint256 agentId, address token, address sale) {
        if (seed < MIN_SEED) revert SeedTooLow();
        uint256 p0 = seed / V;

        agentId = avatars.mint(msg.sender, avatarURI);

        BondingCurveSale s =
            new BondingCurveSale(address(aeon), msg.sender, treasury, rhegiPlatform, p0, SLOPE, MAX_SUPPLY, V);
        AgentToken t = new AgentToken(name, symbol, address(s), MAX_SUPPLY * 1e18);

        // Pull the creator's seed AEON into the sale, then bind token + seed the wall.
        aeon.safeTransferFrom(msg.sender, address(s), seed);
        s.initialize(address(t), seed);

        registry.register(agentId, msg.sender, address(t), address(s), agentId, configHash);

        emit AgentCreated(agentId, msg.sender, address(t), address(s), seed);
        return (agentId, address(t), address(s));
    }
}
