const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

const accountSid = 'ACf51fbf0781882e9e20b9a78e515f50ac';
const authToken = '050c48d79494155ffe5748f3b8607b22';
const client = twilio(accountSid, authToken);

mongoose.connect('mongodb://localhost:27017/betting-game', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
    phone: String,
    otp: String,
    wallet: Number,
});

const User = mongoose.model('User', userSchema);

app.post('/send-otp', async (req, res) => {
    const { phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    client.messages.create({
        body: `Your OTP code is ${otp}`,
        from: '+254799054699',
        to: phone,
    }).then(message => {
        console.log(message.sid);
    }).catch(error => {
        console.error(error);
    });

    const user = await User.findOne({ phone });
    if (user) {
        user.otp = otp;
        await user.save();
    } else {
        const newUser = new User({ phone, otp, wallet: 0 });
        await newUser.save();
    }
    res.send('OTP sent successfully');
});

app.post('/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;
    const user = await User.findOne({ phone, otp });
    if (user) {
        res.send('OTP verified successfully');
    } else {
        res.status(400).send('Invalid OTP');
    }
});

app.post('/reset-password', async (req, res) => {
    const { phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    client.messages.create({
        body: `Your OTP code for password reset is ${otp}`,
        from: 'YOUR_TWILIO_PHONE_NUMBER',
        to: phone,
    }).then(message => {
        console.log(message.sid);
    }).catch(error => {
        console.error(error);
    });

    const user = await User.findOne({ phone });
    if (user) {
        user.otp = otp;
        await user.save();
        res.send('OTP sent for password reset');
    } else {
        res.status(404).send('User not found');
    }
});

app.post('/add-money', async (req, res) => {
    const { phone, amount } = req.body;
    await getAccessToken();
    const response = await initiateSTKPush(phone, amount);

    if (response.ResponseCode === '0') {
        const user = await User.findOne({ phone });
        if (user) {
            user.wallet += parseFloat(amount);
            await user.save();
            res.send('Deposit successful');
        } else {
            res.status(404).send('User not found');
        }
    } else {
        res.status(400).send('Deposit failed');
    }
});

app.post('/withdraw', async (req, res) => {
    const { phone, amount } = req.body;
    const user = await User.findOne({ phone });
    if (user && user.wallet >= amount) {
        await getAccessToken();
        const response = await initiateWithdrawal(phone, amount);

        if (response.ResponseCode === '0') {
            user.wallet -= amount;
            await user.save();
            res.send('Withdrawal successful');
        } else {
            res.status(400).send('Withdrawal failed');
        }
    } else {
        res.status(400).send('Insufficient funds or user not found');
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
