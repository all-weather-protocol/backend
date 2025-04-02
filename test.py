import requests

url = 'http://localhost:3002/generate-intent-txns'

params = {
    'actionName': 'zapIn',
    'chainMetadata': 'arbitrum',
    'portfolioName': 'All Weather Vault',
    'accountAddress': '0xc774806f9fF5f3d8aaBb6b70d0Ed509e42aFE6F0',
    'tokenSymbol': 'usdc',
    'tokenAddress': '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    'investmentAmount': '10000000',
    'tokenDecimals': '6',
    'zapOutPercentage': '0',
    'slippage': '1',
    'recipient': '0xc774806f9fF5f3d8aaBb6b70d0Ed509e42aFE6F0',
    'onlyThisChain': 'True',
    'usdBalance': '100'
}

response = requests.get(url, params=params)

# Print the response
print(response.status_code)
print(response.json())

# About calling the intent API
# prepareTransaction({
#               to: swapCallData["to"],
#               chain: CHAIN_ID_TO_CHAIN[chainId],
#               client: THIRDWEB_CLIENT,
#               data: swapCallData["data"],
#             })