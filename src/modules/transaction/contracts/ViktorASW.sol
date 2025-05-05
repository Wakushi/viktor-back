// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


interface IUniversalRouter {
    function execute(
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable;
}

contract ViktorASW is Ownable {
    using SafeERC20 for IERC20;

    address public constant UNIVERSAL_ROUTER = 0x6fF5693b99212Da76ad316178A184AB56D299b43;

    struct Swap {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 executedAt;
    }

    address private s_agent;
    uint256 private swapCount;
    mapping(uint256 swapId => Swap) private s_swaps;

    error ViktorASW__NotAgent();
    error ViktorASW__TransferFailed();
    error ViktorASW__ZeroAddress();
    error ViktorASW__ZeroAmount();
    error ViktorASW__InsufficientBalance();
    
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);
    event EthWithdrawn(address indexed to, uint256 amount);
    event SwapFailed(string indexed reason);
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 indexed amountIn
    );

    constructor(address _agent) Ownable(msg.sender) {
        if(_agent == address(0)) revert ViktorASW__ZeroAddress();

        s_agent = _agent;
    }

    modifier onlyAgentOrOwner() {
        _ensureOnlyAgentOrOwner();
        _;
    }

    receive() external payable {}

    fallback() external payable {}

    function swapTokens(bytes calldata _path, uint256 _amountIn, uint256 _minOut) external onlyOwner {

        (address tokenIn, address tokenOut) = extractFirstAndLastTokenFromPath(_path);

        IERC20(tokenIn).transfer(address(UNIVERSAL_ROUTER), _amountIn);

        bytes memory commands = new bytes(1);
        commands[0] = bytes1(uint8(0x00)); 

        bytes[] memory inputs = new bytes[](1);
        inputs[0] = abi.encode(
            address(this), 
            _amountIn, 
            _minOut, 
            _path,
            false 
        );

        IUniversalRouter(UNIVERSAL_ROUTER).execute(commands, inputs, block.timestamp + 300);

        s_swaps[swapCount] = Swap(tokenIn, tokenOut, _amountIn, block.timestamp);
        swapCount++;

        emit SwapExecuted(tokenIn, tokenOut, _amountIn);
    }

    function extractFirstAndLastTokenFromPath(bytes memory path) internal pure returns (address tokenIn, address tokenOut) {
        require(path.length >= 20, "Path too short");

        uint256 lastTokenOffset = path.length - 20;

        assembly {
            tokenIn := mload(add(path, 20))
            tokenOut := mload(add(add(path, 0x20), lastTokenOffset))
        }
    }

    function withdrawERC20(address _token, address _to, uint256 _amount) external onlyOwner {
        if(_token == address(0)) revert ViktorASW__ZeroAddress();
        if(_to == address(0)) revert ViktorASW__ZeroAddress();
        if(_amount == 0) revert ViktorASW__ZeroAmount();
        
        IERC20 token = IERC20(_token);

        uint256 balance = token.balanceOf(address(this));

        if(balance < _amount) revert ViktorASW__InsufficientBalance();

        token.safeTransfer(_to, _amount);
        
        emit TokensWithdrawn(_token, _to, _amount);
    }

    function withdrawEth(address _to, uint256 _amount) external onlyOwner {
        if(_to == address(0)) revert ViktorASW__ZeroAddress();
        if(_amount == 0) revert ViktorASW__ZeroAmount();
        
        uint256 balance = address(this).balance;
        if(balance < _amount) revert ViktorASW__InsufficientBalance();

        (bool success, ) = _to.call{value: _amount}("");
        if(!success) revert ViktorASW__TransferFailed();

        emit EthWithdrawn(_to, _amount);
    }

    function _ensureOnlyAgentOrOwner() private view {
        if(msg.sender != s_agent && msg.sender != owner()) {
            revert ViktorASW__NotAgent();
        }
    }

    function getSwap(uint256 _swapId) external view returns(Swap memory){
        return s_swaps[_swapId];
    }

    function getSwapId() external view returns(uint256){
        return swapCount;
    }


}
