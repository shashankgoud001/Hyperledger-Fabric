/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class Account {
	constructor(id, balance) {
		this.id = id;
		this.balance = balance;
	}
}

async function savePrivateData(ctx, assetKey) {
	const clientOrg = ctx.clientIdentity.getMSPID();
	const peerOrg = ctx.stub.getMspID();
	const collection = '_implicit_org_' + peerOrg;

	if (clientOrg === peerOrg) {
		const transientMap = ctx.stub.getTransient();
		if (transientMap) {
			const properties = transientMap.get('asset_properties');
			if (properties) {
				await ctx.stub.putPrivateData(collection, assetKey, properties);
			}
		}
	}
}

async function removePrivateData(ctx, assetKey) {
	const clientOrg = ctx.clientIdentity.getMSPID();
	const peerOrg = ctx.stub.getMspID();
	const collection = '_implicit_org_' + peerOrg;

	if (clientOrg === peerOrg) {
		const propertiesBuffer = await ctx.stub.getPrivateData(collection, assetKey);
		if (propertiesBuffer && propertiesBuffer.length > 0) {
			await ctx.stub.deletePrivateData(collection, assetKey);
		}
	}
}

async function addPrivateData(ctx, assetKey, asset) {
	const clientOrg = ctx.clientIdentity.getMSPID();
	const peerOrg = ctx.stub.getMspID();
	const collection = '_implicit_org_' + peerOrg;

	if (clientOrg === peerOrg) {
		const propertiesBuffer = await ctx.stub.getPrivateData(collection, assetKey);
		if (propertiesBuffer && propertiesBuffer.length > 0) {
			const properties = JSON.parse(propertiesBuffer.toString());
			asset.asset_properties = properties;
		}
	}
}

async function readState(ctx, id) {
	const assetBuffer = await ctx.stub.getState(id); // get the asset from chaincode state
	if (!assetBuffer || assetBuffer.length === 0) {
		throw new Error(`The asset ${id} does not exist`);
	}
	const assetString = assetBuffer.toString();
	const asset = JSON.parse(assetString);

	return asset;
}

class AssetTransferEvents extends Contract {

	async InitLedger(ctx) {
		const publicassets = [
			{
				accountID: 'org1',
				Balance: 1000,
			},
			{
				accountID: 'org2',
				Balance: 2000,
			},
		];


		for (const asset of publicassets) {
			asset.docType = 'asset';
			await ctx.stub.putState(asset.accountID, Buffer.from(JSON.stringify(asset)));
			console.info(`Asset ${asset.accountID} initialized`);
		}



	}

	async AddBalance(ctx, accountID, amount) {

		const asset = await readState(ctx, accountID);
		asset.Balance += parseInt(amount);
		const assetBuffer = Buffer.from(JSON.stringify(asset));
		ctx.stub.setEvent('AddBalance', assetBuffer);
		return ctx.stub.putState(accountID, assetBuffer);
	}
	async GetBalance(ctx, accountId) {
		// Check if the account exists
		const accountBuffer = await ctx.stub.getState(accountId);
		if (!accountBuffer || accountBuffer.length === 0) {
			throw new Error(`Account ${accountId} does not exist`);
		}

		return accountBuffer.toString('utf8');
	}


	// CreateAsset issues a new asset to the world state with given details.
	async AddItem(ctx, id, name, quantity, owner, price) {
		const asset = {
			ID: id,
			Name: name,
			Quantity: quantity,
			Owner: owner,
			Price: price,
		};
		await savePrivateData(ctx, id);
		const assetBuffer = Buffer.from(JSON.stringify(asset));

		ctx.stub.setEvent('AddItem', assetBuffer);
		return ctx.stub.putState(id, assetBuffer);
	}
	// CreateAsset issues a new asset to the world state with given details.
	async CreateAsset(ctx, id, color, size, owner, appraisedValue) {
		const asset = {
			ID: id,
			Color: color,
			Size: size,
			Owner: owner,
			AppraisedValue: appraisedValue,
		};
		await savePrivateData(ctx, id);
		const assetBuffer = Buffer.from(JSON.stringify(asset));

		ctx.stub.setEvent('CreateAsset', assetBuffer);
		return ctx.stub.putState(id, assetBuffer);
	}

	// TransferAsset updates the owner field of an asset with the given id in
	// the world state.
	async TransferAsset(ctx, id, newOwner) {
		const asset = await readState(ctx, id);
		asset.Owner = newOwner;
		const assetBuffer = Buffer.from(JSON.stringify(asset));
		await savePrivateData(ctx, id);

		ctx.stub.setEvent('TransferAsset', assetBuffer);
		return ctx.stub.putState(id, assetBuffer);
	}

	// ReadAsset returns the asset stored in the world state with given id.
	async ReadAsset(ctx, id) {
		const asset = await readState(ctx, id);
		await addPrivateData(ctx, asset.ID, asset);

		return JSON.stringify(asset);
	}
	async GetItem(ctx, id) {
		const asset = await readState(ctx, id);
		await addPrivateData(ctx, asset.ID, asset);

		return JSON.stringify(asset);
	}

	// UpdateAsset updates an existing asset in the world state with provided parameters.
	async UpdateAsset(ctx, id, color, size, owner, appraisedValue) {
		const asset = await readState(ctx, id);
		asset.Color = color;
		asset.Size = size;
		asset.Owner = owner;
		asset.AppraisedValue = appraisedValue;
		const assetBuffer = Buffer.from(JSON.stringify(asset));
		await savePrivateData(ctx, id);

		ctx.stub.setEvent('UpdateAsset', assetBuffer);
		return ctx.stub.putState(id, assetBuffer);
	}
	async DecrementQuantity(ctx, id) {
		const asset = await readState(ctx, id);
		asset.Quantity-=1;
		const assetBuffer = Buffer.from(JSON.stringify(asset));
		await savePrivateData(ctx, id);
		return ctx.stub.putState(id, assetBuffer);
	}

	// DeleteAsset deletes an given asset from the world state.
	async DeleteAsset(ctx, id) {
		const asset = await readState(ctx, id);
		const assetBuffer = Buffer.from(JSON.stringify(asset));
		await removePrivateData(ctx, id);

		ctx.stub.setEvent('DeleteAsset', assetBuffer);
		return ctx.stub.deleteState(id);
	}
	/*
	add to market
	find the asset
	delete the item
	add it to marketplace
	delete it
	*/
	async AddToMarketPlace(ctx, id) {
		const ij = await this.GetItem(ctx, id);
		const itemJSON = JSON.parse(ij);


		const marketplaceKey = 'marketPlace';

		// Retrieve the current marketplace data from the state
		const marketplaceBuffer = await ctx.stub.getState(marketplaceKey);

		let marketplace = { items: [] };

		if (marketplaceBuffer && marketplaceBuffer.length > 0) {
			// If the marketplace data exists, parse it into an object
			marketplace = JSON.parse(marketplaceBuffer.toString());
		}

		// Parse the incoming item JSON string into an object
		// const newItem = JSON.parse(incomingItem);
		const newItem = itemJSON;
		// Check if the item already exists in the marketplace
		const existingItemIndex = marketplace.items.findIndex(item => item.ID === newItem.ID);

		if (existingItemIndex >= 0) {
			// If the item already exists, increase its quantity
			marketplace.items[existingItemIndex].Quantity += 1;
			// const assetBuffer = Buffer.from(JSON.stringify(marketplace.items[existingItemIndex]));
		} else {
			// If the item is not in the marketplace, add it
			newItem.Quantity = 1;
			marketplace.items.push(newItem);
			// const assetBuffer = Buffer.from(JSON.stringify(newItem));
		}

		// Convert the updated marketplace object to a JSON string
		const updatedMarketplaceJSON = JSON.stringify(marketplace);

		// ctx.stub.putState(id, assetBuffer);
		this.DecrementQuantity(ctx,id);
		// Save the updated marketplace JSON string to the state
		return ctx.stub.putState(marketplaceKey, Buffer.from(updatedMarketplaceJSON));
	}

	async GetItemsInMarket(ctx) {
		const marketplaceKey = 'marketPlace';

		// Retrieve the current marketplace data from the state
		const marketplaceBuffer = await ctx.stub.getState(marketplaceKey);

		return marketplaceBuffer.toString();

	}

	async BuyFromMarket(ctx, id, buyer) {

		const marketplaceKey = 'marketPlace';
		const marketplaceBuffer = await ctx.stub.getState(marketplaceKey);

		if (!marketplaceBuffer || marketplaceBuffer.length === 0) {
			throw new Error('Marketplace is empty.');
		}

		const marketplace = JSON.parse(marketplaceBuffer.toString());


		const itemIndex = marketplace.items.findIndex(item => item.ID == id);

		if (itemIndex === -1) {
			throw new Error(`Item with ID ${id} not found in the marketplace.`);
		}

		const item = marketplace.items[itemIndex];



		const balance_ = this.GetBalance(ctx, buyer);
		if (!balance_ || balance_.length === 0) {
			throw new Error(`Buyer with ID ${buyer} does not have a balance.`);
		}

		const buyerBalance = parseInt(balance_.toString(), 10);

		if (buyerBalance < item.Price) {
			throw new Error(`Buyer with ID ${buyer} does not have sufficient balance to buy the item.`);
		}

		// Deduct the item price from the buyer's balance
		const newBuyerBalance = buyerBalance - item.Price;

		this.AddBalance(ctx, buyer, -item.Price);
		this.AddBalance(ctx, item.Owner, item.Price);
		item.Quantity -= 1;
		const updatedMarketplaceJSON = JSON.stringify(marketplace);

		return ctx.stub.putState(marketplaceKey, Buffer.from(updatedMarketplaceJSON));

	}




}

module.exports = AssetTransferEvents;
