// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Primary sale on a discrete linear bonding curve, quoted in AEON.
/// Buys split 70/18/10/2 (creator / bid wall / treasury / platform). Sells redeem
/// AEON from the bid wall at floor = wall / (V + sold). A virtual circulating
/// supply V makes the creator's launch seed an arbitrage-free day-1 floor:
/// floor0 = seed / V = P0, so buys always start at/above the floor.
contract BondingCurveSale is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ExceedsSupply();
    error NotInitialized();
    error AlreadyInitialized();
    error NotInitializer();

    uint256 public constant CREATOR_BPS = 7000;  // 70%
    uint256 public constant TREASURY_BPS = 1000; // 10%
    uint256 public constant PLATFORM_BPS = 200;  //  2%
    uint256 public constant BPS = 10_000;        // bid wall keeps the residual (~18% + dust)

    IERC20 public immutable aeon;
    address public immutable creator;
    address public immutable treasury;
    address public immutable rhegiPlatform;
    address public immutable initializer;

    uint256 public immutable P0;         // AEON wei for the first whole token
    uint256 public immutable SLOPE;      // AEON wei added per whole token
    uint256 public immutable MAX_SUPPLY; // whole tokens
    uint256 public immutable V;          // virtual circulating supply (whole tokens)

    IERC20 public token; // the agent token being sold
    uint256 public sold; // real whole tokens released
    uint256 public wall; // AEON wei held as the bid wall

    event Bought(
        address indexed buyer,
        uint256 amount,
        uint256 cost,
        uint256 creatorCut,
        uint256 wallCut,
        uint256 treasuryCut,
        uint256 platformCut
    );
    event Sold(address indexed seller, uint256 amount, uint256 payout);

    constructor(
        address aeon_,
        address creator_,
        address treasury_,
        address rhegiPlatform_,
        uint256 p0,
        uint256 slope,
        uint256 maxSupply,
        uint256 v
    ) {
        aeon = IERC20(aeon_);
        creator = creator_;
        treasury = treasury_;
        rhegiPlatform = rhegiPlatform_;
        P0 = p0;
        SLOPE = slope;
        MAX_SUPPLY = maxSupply;
        V = v;
        initializer = msg.sender;
    }

    /// @notice Bind the agent token and seed the bid wall. The factory must have
    /// already transferred `seed` AEON into this contract.
    function initialize(address token_, uint256 seed) external {
        if (msg.sender != initializer) revert NotInitializer();
        if (address(token) != address(0)) revert AlreadyInitialized();
        token = IERC20(token_);
        wall = seed;
    }

    /// @dev Cumulative AEON for the first `s` whole tokens. Guards s==0 underflow.
    function areaUnder(uint256 s) public view returns (uint256) {
        if (s == 0) return 0;
        return P0 * s + SLOPE * (s * (s - 1) / 2);
    }

    function costToBuy(uint256 amount) public view returns (uint256) {
        return areaUnder(sold + amount) - areaUnder(sold);
    }

    /// @notice AEON paid out for selling `amount` whole tokens at the floor.
    function quoteSell(uint256 amount) public view returns (uint256) {
        return wall * amount / (V + sold);
    }

    /// @notice Floor price in AEON wei per whole token.
    function floorPrice() external view returns (uint256) {
        return wall / (V + sold);
    }

    function buy(uint256 amount) external nonReentrant {
        if (address(token) == address(0)) revert NotInitialized();
        if (sold + amount > MAX_SUPPLY) revert ExceedsSupply();
        uint256 cost = costToBuy(amount);

        uint256 creatorCut = cost * CREATOR_BPS / BPS;
        uint256 treasuryCut = cost * TREASURY_BPS / BPS;
        uint256 platformCut = cost * PLATFORM_BPS / BPS;
        uint256 wallCut = cost - creatorCut - treasuryCut - platformCut; // ~18% + dust

        // Effects
        sold += amount;
        wall += wallCut;

        // Interactions: pull AEON, fan out cuts, release tokens.
        aeon.safeTransferFrom(msg.sender, address(this), cost);
        aeon.safeTransfer(creator, creatorCut);
        aeon.safeTransfer(treasury, treasuryCut);
        aeon.safeTransfer(rhegiPlatform, platformCut);
        token.safeTransfer(msg.sender, amount * 1e18);

        emit Bought(msg.sender, amount, cost, creatorCut, wallCut, treasuryCut, platformCut);
    }

    function sell(uint256 amount) external nonReentrant {
        if (amount > sold) revert ExceedsSupply();
        uint256 payout = quoteSell(amount);

        // Effects
        sold -= amount;
        wall -= payout;

        // Interactions: pull tokens back, pay AEON from the wall.
        token.safeTransferFrom(msg.sender, address(this), amount * 1e18);
        aeon.safeTransfer(msg.sender, payout);

        emit Sold(msg.sender, amount, payout);
    }
}
