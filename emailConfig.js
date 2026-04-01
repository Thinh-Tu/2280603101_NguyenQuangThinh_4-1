const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    secure: false, // Use true for port 465, false for port 587
    auth: {
        user: "7c36f34dee173b",
        pass: "a551d93e795e6d",
    },
});

module.exports = {
    sendMail: async (to, url) => {
        const info = await transporter.sendMail({
            from: 'admin@haha.com',
            to: to,
            subject: "RESET PASSWORD REQUEST",
            text: "lick vo day de doi pass", // Plain-text version of the message
            html: "lick vo <a href=" + url + ">day</a> de doi pass", // HTML version of the message
        });

        console.log("Message sent:", info.messageId);
    },
    sendUserCredentials: async (to, username, password) => {
        const info = await transporter.sendMail({
            from: 'admin@haha.com',
            to: to,
            subject: "Your New Account Credentials",
            text: `Hello ${username},\n\nYour account has been created.\nUsername: ${username}\nPassword: ${password}\n\nPlease log in and change your password immediately.`,
            html: `<p>Hello <b>${username}</b>,</p>
                   <p>Your account has been created.</p>
                   <ul>
                    <li><b>Username:</b> ${username}</li>
                    <li><b>Password:</b> ${password}</li>
                   </ul>
                   <p>Please log in and change your password immediately.</p>`,
        });

        console.log("Credentials email sent to:", to, "MessageId:", info.messageId);
    }
}
