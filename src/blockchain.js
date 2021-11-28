/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                // defining Block height (Genesis Block height = 0)
                block.height = self.chain.length;
                // creating UTC Timestamp
                block.time = new Date().getTime().toString().slice(0,-3);
                // getting previous Block Hash, exclude Genesis Block
                if(self.chain.length>0){
                    block.previousBlockHash = self.chain[self.chain.length - 1].hash; 
                  }
                // creating Block Hash with SHA256 using block with complete header/body data, converting to a string 
                block.hash = SHA256(JSON.stringify(block)).toString();
                // adding block to the blockchain
                this.chain.push(block);
                // adjusting new blockchain height and resolve
                this.height = self.chain.length - 1;
                // validate chain
                const validate = await self.validateChain();
                if(validate==='Blockchain is valid'){
                    resolve(block);
                } else {
                    reject(new Error("Blockchain is not valid!"))
                }

                
            } catch(error) {
                reject(error);
            }
        });
    }
    
    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            resolve(
                `${address}:${new Date().getTime().toString().slice(0,-3)}:starRegistry`
            )
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            // getting the time from the message and current time
            const messageTime = parseInt(message.split(':')[1]);
            const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));
            // defining maximum allowed elapsed time 5 minutes
            const maxElapsedTime = 60 * 5;

            try{
                // check elapsed time
                if((currentTime - messageTime) >= maxElapsedTime){
                    reject(new Error("5 minute validation time has passed"));
                    return;
                }
                // Verify message,address and signature
                const validation = bitcoinMessage.verify(message, address, signature);
                if(!validation){
                    reject(new Error("Verification is invalid"));
                    return;
                }
                // creating new block with owner and star as block body/data
                const newBlock = new BlockClass.Block({'owner': address,'star':star});
                // adding block to blockchain 
                await self._addBlock(newBlock);
                resolve(newBlock);
            } catch (error) {
                reject(error);
            }    
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.hash === hash)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        let stars = [];
        return new Promise(async (resolve, reject) => {
            // Loop over chain and skip Genesis Block
            for (var i = 1; i < this.chain.length; i++) {
                // validate block
                const blockData = await self.chain[i].getBData() 
                if (blockData.owner === address) {
                    stars.push(blockData);
                }
            }
            resolve(stars)    
            
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            // Loop over chain and skip Genesis Block
            for (var i = 0; i < this.chain.length-1; i++) {
                // validate block
                if (!(await self.chain[i].validate())) {
                    errorLog.push(i);
                }
                // compare blocks hash link
                let blockHash = self.chain[i].hash;
                let previousHash = self.chain[i+1].previousBlockHash;
                if (blockHash!==previousHash) {
                  errorLog.push(i);
                }
            }
            if (errorLog.length>0) {
                  resolve({
                      'Block errors': errorLog.length,
                      'Blocks': errorLog
                  })
            } else {
                resolve('Blockchain is valid');
            }
            
        });
    }

}

module.exports.Blockchain = Blockchain;   