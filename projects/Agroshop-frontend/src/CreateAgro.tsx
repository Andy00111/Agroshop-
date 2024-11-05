import { Config as AlgokitConfig, microAlgos } from '@algorandfoundation/algokit-utils'
import AlgorandClient from '@algorandfoundation/algokit-utils/types/algorand-client'
import { useWallet } from '@txnlab/use-wallet'
import algosdk, { decodeAddress, decodeUint64, encodeAddress, encodeUint64 } from 'algosdk'
import React, { useState } from 'react'
import ConnectWallet from './components/ConnectWallet'
import MethodCall from './components/MethodCall'
import { AgroshopClient } from './contracts/Agroshop'
import * as methods from './methods'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
import { useQuery } from '@tanstack/react-query'
import Navbar from './components/Navbar'

interface HomeProps {}

const Account: React.FC<HomeProps> = () => {
  AlgokitConfig.configure({ populateAppCallResources: true })

  const [openWalletModal, setOpenWalletModal] = useState<boolean>(false)
  const [appId, setAppId] = useState<number>(0)
  const [amountToSell, setAmountToSell] = useState<bigint>(0n)
  const [sellingPrice, setSellingPrice] = useState<bigint>(0n)
  const listingsQuery = useQuery({
    queryKey: ['listings', appId],
    queryFn: async () => {
      const boxNames = await algorand.client.algod.getApplicationBoxes(appId).do()
      return await Promise.all(
        boxNames.boxes.map(async (box) => {
          const boxContent = await algorand.client.algod.getApplicationBoxByName(appId, box.name).do()
          return {
            seller: encodeAddress(box.name.slice(0, 32)),
            assetId: decodeUint64(box.name.slice(32, 40), 'bigint'),
            nonce: decodeUint64(box.name.slice(40, 48), 'bigint'),
            amount: decodeUint64(boxContent.value.slice(0, 8), 'bigint'),
            unitaryPrice: decodeUint64(boxContent.value.slice(8, 16), 'bigint'),
          }
        }),
      )
    },
    staleTime: 1_000,
  })
  const [sellerAddress, setSellerAddress] = useState<string>('')
  const [buyingAssetId, setBuyingAssetId] = useState<bigint>(0n)
  const [buyingQuantity, setBuyingQuantity] = useState<bigint>(0n)
  const [buyingPrice, setBuyingPrice] = useState<bigint>(0n)
  const { activeAddress, signer } = useWallet()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const algorand = AlgorandClient.fromConfig({ algodConfig })
  algorand.setDefaultSigner(signer)

  const dmClient = new AgroshopClient(
    {
      resolveBy: 'id',
      id: appId,
      sender: { addr: activeAddress!, signer },
    },
    algorand.client.algod,
  )

  const toggleWalletModal = () => {
    setOpenWalletModal(!openWalletModal)
  }

  return (
    <>
      <Navbar/>
    <div className="min-h-screen bg-gradient-to-br from-green-400 to-blue-500 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <h1 className="text-4xl font-extrabold text-gray-900 text-center mb-6">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">Agroshop</span>
          </h1>
          <p className="text-xl text-gray-600 text-center mb-8">
            Your decentralized supply chain solution
          </p>

          <div className="space-y-8">
            <div className="flex justify-center">
              <button
                data-test-id="connect-wallet"
                className="btn bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold py-3 px-6 rounded-full hover:from-green-500 hover:to-blue-600 transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105"
                onClick={toggleWalletModal}
              >
                Connect Wallet
              </button>
            </div>

            {activeAddress && appId === 0 && (
              <div className="bg-gray-100 p-6 rounded-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Create Marketplace</h2>
                <MethodCall methodFunction={methods.create(algorand, dmClient, activeAddress, setAppId)} text="Create Marketplace" />
              </div>
            )}

            {appId !== 0 && activeAddress && (
              <div className="bg-gray-100 p-6 rounded-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Sell Asset</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="amountToSell" className="block text-sm font-medium text-gray-700 mb-1">Amount To Sell</label>
                    <input
                      id="amountToSell"
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
                      value={amountToSell.toString()}
                      onChange={(e) => setAmountToSell(BigInt(e.currentTarget.valueAsNumber || 0n))}
                    />
                  </div>
                  <div>
                    <label htmlFor="sellingPrice" className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
                    <input
                      id="sellingPrice"
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
                      value={sellingPrice.toString()}
                      onChange={(e) => setSellingPrice(BigInt(e.currentTarget.valueAsNumber || 0n))}
                    />
                  </div>
                  <MethodCall
                    methodFunction={methods.sell(algorand, dmClient, activeAddress, amountToSell, sellingPrice)}
                    text="Sell Asset"
                  />
                </div>
              </div>
            )}

            {appId !== 0 && (
              <div className="bg-gray-100 p-6 rounded-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Available Products</h2>
                {!listingsQuery.isError ? (
                  <ul className="space-y-2">
                    {listingsQuery.data?.map((listing) => (
                      <li
                        key={listing.seller + listing.assetId.toString() + listing.nonce.toString()}
                        className="bg-white p-4 rounded-md shadow"
                      >
                        <p className="font-semibold">Asset ID: {listing.assetId.toString()}</p>
                        <p>Amount: {listing.amount.toString()}</p>
                        <p>Price: {listing.unitaryPrice.toString()} ALGO</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-red-500">Error loading listings</p>
                )}
              </div>
            )}

            {activeAddress && appId !== 0 && (
              <div className="bg-gray-100 p-6 rounded-lg">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Buy Asset</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="sellerAddress" className="block text-sm font-medium text-gray-700 mb-1">Seller Address</label>
                    <input
                      id="sellerAddress"
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
                      value={sellerAddress}
                      onChange={(e) => setSellerAddress(e.currentTarget.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="buyingAssetId" className="block text-sm font-medium text-gray-700 mb-1">Asset To Buy</label>
                    <input
                      id="buyingAssetId"
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
                      value={buyingAssetId.toString()}
                      onChange={(e) => setBuyingAssetId(BigInt(e.currentTarget.valueAsNumber || 0n))}
                    />
                  </div>
                  <div>
                    <label htmlFor="buyingQuantity" className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input
                      id="buyingQuantity"
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
                      value={buyingQuantity.toString()}
                      onChange={(e) => setBuyingQuantity(BigInt(e.currentTarget.valueAsNumber || 0n))}
                    />
                  </div>
                  <div>
                    <label htmlFor="buyingPrice" className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                    <input
                      id="buyingPrice"
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
                      value={buyingPrice.toString()}
                      onChange={(e) => setBuyingPrice(BigInt(e.currentTarget.valueAsNumber || 0n))}
                    />
                  </div>
                  <MethodCall
                    methodFunction={methods.buy(algorand, dmClient, sellerAddress, buyingAssetId, activeAddress, buyingQuantity, buyingPrice)}
                    text={`Buy ${buyingQuantity} unit for ${Number(buyingPrice * buyingQuantity)} ALGO`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConnectWallet openModal={openWalletModal} closeModal={toggleWalletModal} />
    </div>
    </>
  )
}

export default Account
