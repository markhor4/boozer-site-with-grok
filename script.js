// Initialize Solana connection (Devnet for testing)
const connection = new solanaWeb3.Connection('https://api.devnet.solana.com', 'confirmed');
const BOOZ_MINT = new solanaWeb3.PublicKey('YOUR_DEVNET_MINT_ADDRESS'); // Replace with Devnet mint for testing
const PRESALE_WALLET = new solanaWeb3.PublicKey('HY6po9XbgiZEztwbphc4Uo2q5SYAc5RFb1Axg5h8T7Vy');
let userWallet = null;

// Backend URL (temporary for local testing)
const BACKEND_URL = 'http://localhost:3000'; // Update to Vercel URL after deployment

// Fetch Live SOL Price
let solPriceInUSD = 0;
async function fetchSolPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        solPriceInUSD = data.solana.usd || 0;
        document.getElementById('sol-price').innerText = solPriceInUSD ? `$${solPriceInUSD.toFixed(2)}` : 'Price unavailable';
    } catch (error) {
        console.error('Error fetching SOL price:', error);
        document.getElementById('sol-price').innerText = 'Price unavailable';
    }
}
fetchSolPrice();
setInterval(fetchSolPrice, 60000);

// Wallet Connection
async function connectWallet() {
    if (window.solana && window.solana.isPhantom) {
        try {
            await window.solana.connect();
            userWallet = window.solana.publicKey;
            document.getElementById('connected-wallet').textContent = `Wallet: ${userWallet.toString()}`;
            updateButtonState();
        } catch (error) {
            console.error('Wallet connection failed:', error);
            alert('Failed to connect wallet. Please try again.');
        }
    } else {
        alert('Please install a Solana wallet like Phantom.');
    }
}

// Presale Logic
let tokensSold = 0;
async function fetchTokensSold() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/tokens-sold`);
        const data = await response.json();
        tokensSold = data.tokensSold || 0;
        updatePriceDisplay();
    } catch (error) {
        console.error('Error fetching tokens sold:', error);
    }
}
fetchTokensSold();
setInterval(fetchTokensSold, 30000);

function getCurrentPrice() {
    if (tokensSold >= 300000000) {
        return { price: 0, round: 'Ended' };
    }
    const step = Math.floor(tokensSold / 5000000) + 1;
    let price, round;
    if (tokensSold < 100000000) {
        price = 0.00003 + (step - 1) * 0.000002;
        round = '🍺 Boozer Shot';
    } else if (tokensSold < 200000000) {
        price = 0.00004 + (step - 21) * 0.000002;
        round = '🍻 Boozer Cheers';
    } else {
        price = 0.00005 + (step - 41) * 0.000002;
        round = '🎉 Party Popper';
    }
    return { price: price, round: round };
}

function updatePriceDisplay() {
    const { price, round } = getCurrentPrice();
    const priceInfo = document.getElementById('price-info');
    const tokensSoldDisplay = document.getElementById('tokens-sold');
    const progressBar = document.getElementById('progress-bar');
    tokensSoldDisplay.textContent = tokensSold.toLocaleString();
    const progressPercent = (tokensSold / 300000000) * 100;
    progressBar.style.width = `${progressPercent}%`;
    if (price === 0) {
        priceInfo.textContent = 'Presale Ended!';
    } else {
        priceInfo.textContent = `Current Price: $${price.toFixed(6)} per BOOZ (${round})`;
    }
    updateButtonState();
}

// Check Presale Status
const presaleStartDate = new Date('2025-06-25T00:00:00+05:00');
const presaleEndDate = new Date('2025-07-02T00:00:00+05:00');
function checkPresaleStatus() {
    const now = new Date();
    const timerElement = document.getElementById('presale-timer');
    if (now < presaleStartDate) {
        const timeLeft = presaleStartDate - now;
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        timerElement.textContent = `Presale Starts in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (now < presaleEndDate) {
        startTimer();
    } else {
        timerElement.textContent = 'Presale Ended!';
    }
    updateButtonState();
}
setInterval(checkPresaleStatus, 1000);

function updateButtonState() {
    const buyButton = document.getElementById('buy-booz');
    const now = new Date();
    const solAmount = parseFloat(document.getElementById('sol-amount').value) || 0;
    buyButton.disabled = !userWallet || now < presaleStartDate || now >= presaleEndDate || solAmount < 0.05 || solAmount > 5 || tokensSold >= 300000000;
}

// Calculate BOOZ and USD
const solAmountInput = document.getElementById('sol-amount');
const boozAmountDisplay = document.getElementById('booz-amount');
const usdCostDisplay = document.getElementById('usd-cost');
function updateCalculations() {
    const solAmount = parseFloat(solAmountInput.value) || 0;
    const { price } = getCurrentPrice();
    if (price === 0) {
        boozAmountDisplay.textContent = '0';
        usdCostDisplay.textContent = '0';
        return;
    }
    if (solPriceInUSD === 0) {
        boozAmountDisplay.textContent = 'Waiting for SOL price...';
        usdCostDisplay.textContent = '$0';
        return;
    }
    const usdAmount = Number((solAmount * solPriceInUSD).toFixed(8));
    let boozAmount = Math.floor(Number((usdAmount / price).toFixed(8)));
    const remainingTokens = 300000000 - tokensSold;
    if (boozAmount > remainingTokens) {
        boozAmount = remainingTokens;
    }
    boozAmountDisplay.textContent = boozAmount.toLocaleString();
    usdCostDisplay.textContent = usdAmount.toFixed(2);
    updateButtonState();
}
solAmountInput.addEventListener('input', updateCalculations);

// Transaction History
const transactionList = document.getElementById('transaction-list');
let transactions = JSON.parse(localStorage.getItem('boozTransactions')) || [];
function addTransaction(usdSpent, boozReceived, signature) {
    transactions.push({ usdSpent, boozReceived, timestamp: new Date().toLocaleString(), signature });
    localStorage.setItem('boozTransactions', JSON.stringify(transactions));
    renderTransactions();
}
function renderTransactions() {
    transactionList.innerHTML = '';
    transactions.forEach(tx => {
        const li = document.createElement('li');
        li.innerHTML = `Spent $${tx.usdSpent.toFixed(2)} USD, Received ${tx.boozReceived.toLocaleString()} BOOZ on ${tx.timestamp} (<a href="https://explorer.solana.com/tx/${tx.signature}?cluster=devnet" target="_blank">View</a>)`;
        transactionList.appendChild(li);
    });
}
renderTransactions();

// Buy BOOZ
async function buyBooz() {
    if (!userWallet) {
        alert('Please connect your wallet first.');
        return;
    }
    const solAmount = parseFloat(solAmountInput.value) || 0;
    if (solAmount < 0.05 || solAmount > 5) {
        alert('Please enter a SOL amount between 0.05 and 5.');
        return;
    }
    const now = new Date();
    if (now < presaleStartDate) {
        alert('Presale has not started yet! It starts on June 25, 2025.');
        return;
    }
    if (now >= presaleEndDate) {
        alert('Presale has ended!');
        return;
    }
    const { price, round } = getCurrentPrice();
    if (round === 'Ended') {
        alert('Presale has ended!');
        return;
    }
    if (solPriceInUSD === 0) {
        alert('SOL price not available. Please try again later.');
        return;
    }

    const usdAmount = Number((solAmount * solPriceInUSD).toFixed(8));
    let boozAmount = Math.floor(Number((usdAmount / price).toFixed(8)));
    const remainingTokens = 300000000 - tokensSold;
    if (boozAmount > remainingTokens) {
        alert(`Purchase exceeds remaining tokens! Only ${remainingTokens.toLocaleString()} BOOZ left.`);
        return;
    }

    try {
        // Create SOL transfer transaction
        const transaction = new solanaWeb3.Transaction();
        const lamports = Math.floor(solAmount * solanaWeb3.LAMPORTS_PER_SOL);
        transaction.add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: userWallet,
                toPubkey: PRESALE_WALLET,
                lamports
            })
        );

        // Sign and send transaction
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        transaction.feePayer = userWallet;
        const signed = await window.solana.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signed.serialize());

        // Poll for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        if (confirmation.value.err) {
            throw new Error('Transaction failed');
        }

        // Notify backend
        const response = await fetch(`${BACKEND_URL}/api/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                signature,
                solAmount,
                usdAmount,
                boozAmount,
                wallet: userWallet.toString(),
                round
            })
        });
        if (!response.ok) {
            throw new Error('Backend verification failed');
        }

        // Update UI
        tokensSold += boozAmount;
        addTransaction(usdAmount, boozAmount, signature);
        updatePriceDisplay();
        updateCalculations();
        alert('Purchase successful! BOOZ tokens sent to your wallet.');
    } catch (error) {
        console.error('Purchase error:', error);
        alert('Purchase failed. Please try again.');
    }
}

// Presale Timer
function startTimer() {
    const timerElement = document.getElementById('presale-timer');
    setInterval(() => {
        const now = new Date();
        const timeLeft = presaleEndDate - now;
        if (timeLeft <= 0) {
            timerElement.textContent = 'Presale Ended!';
            updateButtonState();
            return;
        }
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        timerElement.textContent = `Presale Ends in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
}

// Attach event listeners
document.querySelector('.wallet-connect').addEventListener('click', connectWallet);
document.getElementById('buy-booz').addEventListener('click', buyBooz);

// Initialize
checkPresaleStatus();
updatePriceDisplay();
updateCalculations();