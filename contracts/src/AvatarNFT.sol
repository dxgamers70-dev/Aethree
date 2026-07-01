// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Avatar collection. tokenId doubles as the agentId across AeThree.
contract AvatarNFT is ERC721, Ownable {
    error NotMinter();

    uint256 public nextId = 1;
    mapping(uint256 => string) private _uris;
    mapping(address => bool) public isMinter;

    constructor(address owner_) ERC721("AeThree Avatar", "AVATAR") Ownable(owner_) {}

    function setMinter(address who, bool allowed) external onlyOwner {
        isMinter[who] = allowed;
    }

    function mint(address to, string calldata uri) external returns (uint256 id) {
        if (!isMinter[msg.sender]) revert NotMinter();
        id = nextId++;
        // Use _mint (not _safeMint) so smart-contract wallets that don't implement
        // onERC721Received (e.g. Coinbase Smart Wallet on Base) can launch agents.
        _mint(to, id);
        _uris[id] = uri;
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return _uris[id];
    }
}
