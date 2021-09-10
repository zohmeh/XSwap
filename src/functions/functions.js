const moralis = require("moralis");
const { mappedPoSTokensEth, mappedPoSTokensPolygon } = require("./addresses.js");
const axios = require("axios");
const { erc20ABI } = require("../helpers/contractABI");
const MaticPOSClient = require("@maticnetwork/maticjs").MaticPOSClient;
const Matic = require("@maticnetwork/maticjs").default;
const web3 = require("web3");

moralis.initialize("dOiVpAxnylme9VPx99olzmbyQzB4Jk2TgL0g1Y5A");
moralis.serverURL = "https://kuuj059ugtmh.usemoralis.com:2053/server";

async function init() {
  window.web3 = await moralis.Web3.enable();
}

init();

module.exports = {
  Login: async function () {
    try {
      const user = await moralis.authenticate();
      return user;
    } catch (error) {
      console.log(error);
    }
  },

  Logout: async function () {
    try {
      await moralis.User.logOut();
      return false;
    } catch (error) {
      console.log(error);
    }
  },

  getMyBalances: async function () {
    try {
      const user = await moralis.User.current();
      // Query Moralisdatabase only if user is logged in
      if (user) {
        // Fetching 1inch Tokens to add the token Image later
        const oneInchToken = await Promise.all([
          axios.get("https://api.1inch.exchange/v3.0/1/tokens"),
          axios.get("https://api.1inch.exchange/v3.0/137/tokens"),
        ]);

        const oneInchTokenEth = oneInchToken[0].data.tokens;
        const oneInchTokenPolygon = oneInchToken[1].data.tokens;

        // Fetching balances from Moralis database
        const _userAddress = user.attributes.ethAddress;
        const params = { address: _userAddress };
        const balances = await moralis.Cloud.run("getMyBalances", params);

        // Prepare for Fetching all the usdPrices in parallel await function
        let tokenPricePromises = [];
        // adding the native currencies from coingecko for eth
        tokenPricePromises.push(
          axios.get(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum&order=market_cap_desc&per_page=100&page=1&sparkline=false`
          )
        );
        // adding the native currencies from coingecko for matic
        tokenPricePromises.push(
          axios.get(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=matic-network&order=market_cap_desc&per_page=100&page=1&sparkline=false`
          )
        );
        // adding the promises for all other ERC20 tokens -> fetches prices from Moralis database
        for (let i = 2; i < balances.length; i++) {
          const promise = moralis.Web3API.token.getTokenPrice({
            address: balances[i]["tokenAddress"],
            chain: balances[i]["chainName"],
          });
          tokenPricePromises.push(promise);
        }

        // resolve the usdPrices
        const usdPrices = await Promise.all(tokenPricePromises);
        // adding the prices and tokenimages to the return object balances
        for (let i = 0; i < balances.length; i++) {
          if (
            balances[i]["tokenAddress"] ===
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
          ) {
            balances[i]["usdPrice"] = usdPrices[i].data[0].current_price;
          }
          // If balance is for matic as native the usd price must be fetched from coingecko API
          else if (
            balances[i]["tokenAddress"] ===
            "0x0000000000000000000000000000000000001001"
          ) {
            balances[i]["usdPrice"] = usdPrices[i].data[0].current_price;
          }
          // the usd price for all other tokens can be fetched from moralis
          else {
            balances[i]["usdPrice"] = usdPrices[i].usdPrice ? usdPrices[i].usdPrice : "NAN";
            // setting the token image
            // ask if the token is on eth or on polygon
            if (balances[i]["chainName"] === "eth") {
              balances[i]["image"] = oneInchTokenEth[balances[i]["tokenAddress"]] ? oneInchTokenEth[balances[i]["tokenAddress"]]["logoURI"] : false;
            }
            if (balances[i]["chainName"] === "polygon") {
              balances[i]["image"] = oneInchTokenPolygon[balances[i]["tokenAddress"]] ? oneInchTokenPolygon[balances[i]["tokenAddress"]]["logoURI"] : false;
            }
          }
        }
        return balances;
      }
    } catch (error) {
      console.log(error);
    }
  },

  getMyEthTransactions: async function () {
    try {
      const user = await moralis.User.current();
      mappedPoSTokensEth.push(
        "0xA0c68C638235ee32657e8f720a23ceC1bFc77C77".toLowerCase(),
        "0x401F6c983eA34274ec46f84D70b31C151321188b".toLowerCase(),
        "0x11111112542d85b3ef69ae05771c2dccff4faa26".toLowerCase()
      );
      const paramsTx = {
        address: user.attributes.ethAddress,
        tokens: mappedPoSTokensEth,
      };
      const responseTransactions = await moralis.Cloud.run(
        "getEthTransactions",
        paramsTx
      );
      let methode;
      for (var i = 0; i < responseTransactions.length; i++) {
        if (
          responseTransactions[i]["method"].substring(0, 10) ===
          window.web3.eth.abi.encodeFunctionSignature(
            "depositEtherFor(address)"
          )
        ) {
          methode = "Deposit Ether For";
        } else if (
          responseTransactions[i]["method"].substring(0, 10) ===
          window.web3.eth.abi.encodeFunctionSignature("exit(bytes)")
        ) {
          methode = "Exit";
        } else if (
          responseTransactions[i]["method"].substring(0, 10) === "0x8b9e4f93"
        ) {
          methode = "Deposit ERC20 For User";
        } else if (
          responseTransactions[i]["method"].substring(0, 10) === "0x2e95b6c8"
        ) {
          methode = "Swap";
        } else if (
          responseTransactions[i]["method"].substring(0, 10) === "0x095ea7b3"
        ) {
          methode = "Approve";
        } else {
          methode = responseTransactions[i]["method"].substring(0, 10);
        }
        responseTransactions[i]["method"] = methode;
      }
      return responseTransactions;
    } catch (error) {
      console.log(error);
    }
  },

  getMyPolygonTransactions: async function () {
    try {
      const user = await moralis.User.current();
      mappedPoSTokensPolygon.push(
        "0x11111112542d85b3ef69ae05771c2dccff4faa26"
      );
      const paramsTx = {
        address: user.attributes.ethAddress,
        tokens: mappedPoSTokensPolygon,
      };
      const responseTransactions = await moralis.Cloud.run(
        "getPolygonTransactions",
        paramsTx
      );
      let methode;
      for (var i = 0; i < responseTransactions.length; i++) {
        if (
          responseTransactions[i]["method"].substring(0, 10) ===
          window.web3.eth.abi.encodeFunctionSignature("withdraw(uint256)")
        ) {
          methode = "Withdraw";
        } else if (
          responseTransactions[i]["method"].substring(0, 10) === "0x095ea7b3"
        ) {
          methode = "Approve";
        } else if (
          responseTransactions[i]["method"].substring(0, 10) === "0x7c025200"
        ) {
          methode = "Swap";
        } else {
          methode = responseTransactions[i]["method"].substring(0, 10);
        }
        responseTransactions[i]["method"] = methode;
      }
      return responseTransactions;
    } catch (error) {
      console.log(error);
    }
  },

  calcExpectedReturn: async function (_fromTokenAddress, _fromTokenDecimals, _toTokenAddress, _swapAmount, _fromChain, _toChain) {
    let expectedReturn;
    // select the correct swap
    // if fromChain == toChain than the expected return can be directly calculated
    if(_fromChain === _toChain) {
      const quoteRequest = await _getQuote(_fromTokenAddress, _toTokenAddress, _swapAmount, _toChain);
      expectedReturn = (parseInt(quoteRequest.toTokenAmount)) / Math.pow(10, quoteRequest.toToken.decimals);
    }
    // XSwap from Ethereumchain to Polygonchain
    else if(_fromChain === 1 && _toChain === 137) {
      // First check if the token can be directly bridged with the pos bridge
      if(mappedPoSTokensEth.includes(_fromTokenAddress)) {
        var _fromTokenIndex = mappedPoSTokensEth.indexOf(_fromTokenAddress);
        const _fromTokenAddressOnPolygon = mappedPoSTokensPolygon[_fromTokenIndex];
        // Check if the FromTokenAddress is the same as the ToTokenAddress otherwise it means that the Token will only be bridged 1 to 1 and the return will be 1
        if(_fromTokenAddressOnPolygon !== _toTokenAddress) {
          const quoteRequest = await _getQuote(_fromTokenAddressOnPolygon, _toTokenAddress, _swapAmount, _toChain);
          expectedReturn = (parseInt(quoteRequest.toTokenAmount)) / Math.pow(10, quoteRequest.toToken.decimals);
        }
        else {
          expectedReturn = _swapAmount / Math.pow(10, _fromTokenDecimals);
        }
      }
      // else if the fromToken is MATIC it must be bridged directly with the Plasmabridge
      else if(_fromTokenAddress === "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0") {
        const _fromTokenAddressOnPolygon = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        const quoteRequest = await _getQuote(_fromTokenAddressOnPolygon, _toTokenAddress, _swapAmount, _toChain);
        expectedReturn = (parseInt(quoteRequest.toTokenAmount)) / Math.pow(10, quoteRequest.toToken.decimals);
      }
      // else if the fromToken cannot directly be bridged it will first be swapped to ETH on Ethereumchain than bridged with PoS Bridge and than again be swapped to the final Token on Polygon
      else {
        const quoteRequestSwapOnETH = await _getQuote(_fromTokenAddress, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", _swapAmount, _fromChain);
        const ethAmountToBridge = quoteRequestSwapOnETH.toTokenAmount;
        const quoteRequestSwapOnPolygon = await _getQuote("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", _toTokenAddress, ethAmountToBridge, _toChain);
        expectedReturn = (parseInt(quoteRequestSwapOnPolygon.toTokenAmount)) / Math.pow(10, quoteRequestSwapOnPolygon.toToken.decimals);
      }
    }
    // XSwap from Polygonchain to Ethereumchain
    else if(_fromChain === 137 && _toChain ===1) {
      // First check again if the token can be directly bridged with the pos bridge
      if(mappedPoSTokensPolygon.includes(_fromTokenAddress)) {
        var _fromTokenIndex = mappedPoSTokensPolygon.indexOf(_fromTokenAddress);
        const _fromTokenAddressOnEth = mappedPoSTokensEth[_fromTokenIndex];
        // Check if the FromTokenAddress is the same as the ToTokenAddress otherwise it means that the Token will only be bridged 1 to 1 and the return will be 1
        if(_fromTokenAddressOnEth !== _toTokenAddress) {
          const quoteRequest = await _getQuote(_fromTokenAddressOnEth, _toTokenAddress, _swapAmount, _toChain);
          expectedReturn = (parseInt(quoteRequest.toTokenAmount)) / Math.pow(10, quoteRequest.toToken.decimals);
        }
        else {
          expectedReturn = _swapAmount / Math.pow(10, _fromTokenDecimals);
        }        
      }
      // else if the fromToken is MATIC it must be bridged directly with the Plasmabridge
      else if(_fromTokenAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
        const _fromTokenAddressOnEth = "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0";
        const quoteRequest = await _getQuote(_fromTokenAddressOnEth, _toTokenAddress, _swapAmount, _toChain);
        expectedReturn = (parseInt(quoteRequest.toTokenAmount)) / Math.pow(10, quoteRequest.toToken.decimals);
      }
      // else if the fromToken cannot directly be bridged it will first be swapped to WETH on Polygonchain than bridged with PoS Bridge and than again be swapped to the final Token on Eth
      else {
        const quoteRequestSwapOnPolygon = await _getQuote(_fromTokenAddress, "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", _swapAmount, _fromChain);
        const wethAmountToBridge = quoteRequestSwapOnPolygon.toTokenAmount;
        const quoteRequestSwapOnEth = await _getQuote("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", _toTokenAddress, wethAmountToBridge, _toChain);
        expectedReturn = (parseInt(quoteRequestSwapOnEth.toTokenAmount)) / Math.pow(10, quoteRequestSwapOnEth.toToken.decimals);
      }
    }
    return expectedReturn;
  },

  swapTokens: async function (
    _fromTokenAddress,
    _toTokenAddress,
    _swapAmount,
    _fromChain,
    _toChain,
    _slippage,
    _status
  ) {
    let _jobId;
    // Check if status = new and store new Job in moralis DB
    if (_status === "new") {
      _jobId = await _storeJobData(
        _fromTokenAddress,
        _toTokenAddress,
        _swapAmount,
        _fromChain,
        _toChain,
        _slippage
      );
    }
    // If fromChain == toChain than direct Networkcheck and Swap
    if (_fromChain === _toChain) {
      // Check or the right network in Metamask
      await _networkCheck(_toChain);
      // Do the swap
      await _doSwap(_jobId);
      // Delete the Job after swapping
      await _deleteJobById(_jobId);
    }
  },

  getMyJobs: async function () {
    const user = await moralis.User.current();
    const params = { address: user.attributes.ethAddress };
    const myJobs = await moralis.Cloud.run("getMyJobs", params);
    return myJobs;
  },

  deleteJobById: async function (_jobId) {
    const params = { id: _jobId };
    let job = await moralis.Cloud.run("getJobsById", params);
    await job.destroy();
  },

  getJobById: async function (_jobId) {
    const params = { id: _jobId };
    let job = await moralis.Cloud.run("getJobsById", params);
    return job;
  }

};

async function _doSwap(_jobId) {
  const user = await moralis.User.current();
  const _userAddress = user.attributes.ethAddress;

  //find job by id
  const params = { id: _jobId };
  let job = await moralis.Cloud.run("getJobsById", params);

  //if an ERC20 token should be swapped than first approve 1inch to spend token
  if (
    job.attributes.fromTokenAddress !=
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  ) {
    window.ERC20TokencontractInstance = new window.web3.eth.Contract(
      erc20ABI,
      job.attributes.fromTokenAddress
    );
    await window.ERC20TokencontractInstance.methods
      .approve(
        "0x11111112542d85b3ef69ae05771c2dccff4faa26",
        job.attributes.amount
      )
      .send({ from: _userAddress });
  }

  let response = await fetch(
    `https://api.1inch.exchange/v3.0/${job.attributes.toChain}/swap?fromTokenAddress=${job.attributes.fromTokenAddress}&toTokenAddress=${job.attributes.toTokenAddress}&amount=${job.attributes.amount}&fromAddress=${_userAddress}&slippage=${job.attributes.slippage}`
  );

  const swap = await response.json();
  const send = await window.web3.eth.sendTransaction(swap.tx);

  job.set("txHash", send.transactionHash);
  job.set("status", "swapped");
  job.set("amount", swap["toTokenAmount"]);
  job.set("fromTokenAddress", job.attributes.toTokenAddress);
  await job.save();
  return ["swapped", swap["toTokenAmount"]];
}

async function _networkCheck(_networkId) {
  let network = await window.web3.eth.net.getId();
  if (network !== _networkId && network === 1) {
    alert("Please Change Network in Metamask to Polygon and then press OK");
  } else if (network !== _networkId && network === 137) {
    alert("Please Change Network in Metamask to Ethereum and then press OK");
  }
}

async function _deleteJobById(_jobId) {
  const params = { id: _jobId };
  let job = await moralis.Cloud.run("getJobsById", params);
  await job.destroy();
}

async function _storeJobData(
  _fromTokenAddress,
  _toTokenAddress,
  _amount,
  _fromChain,
  _toChain,
  _slippage
) {
  let user = await moralis.User.current();
  const _userAddress = user.attributes.ethAddress;
  const Jobs = moralis.Object.extend("Jobs");
  const job = new Jobs();

  job.set("user", _userAddress);
  job.set("fromTokenAddress", _fromTokenAddress);
  job.set("toTokenAddress", _toTokenAddress);
  job.set("amount", _amount);
  job.set("fromChain", _fromChain);
  job.set("toChain", _toChain);
  job.set("txHash", "");
  job.set("status", "new");
  job.set("slippage", _slippage);

  await job.save();

  return job.id;
}

async function _getQuote(_fromTokenAddress, _toTokenAddress, _swapAmount, _chain) {
  try {
    const response = await axios.get(`https://api.1inch.exchange/v3.0/${_chain}/quote?fromTokenAddress=${_fromTokenAddress}&toTokenAddress=${_toTokenAddress}&amount=${_swapAmount}`);
    return (response.data);
  } catch (error) { console.log(error); }
}