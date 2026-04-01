const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
require('dotenv').config();

// Import các model schema
const User = require('./schemas/users');
const Role = require('./schemas/roles');

// Load thư viện email tùy chỉnh
const emailConfig = require('./emailConfig');

// Hàm tạo ngẫu nhiên chuỗi 16 kí tự
function generateRandomPassword() {
    return crypto.randomBytes(8).toString('hex');
}

// Hàm chính đọc file users.txt và import vào MongoDB
async function importUsers() {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/NNPTUD-C4';
        // Kết nối CSDL
        await mongoose.connect(uri);
        console.log("Đã kết nối tới MongoDB");

        // Tìm hoặc tạo ROLE 'user'
        let userRole = await Role.findOne({ name: 'user' });
        if (!userRole) {
            console.log("Chưa có role 'user', đang tạo mới...");
            userRole = new Role({ name: 'user', description: 'Người dùng bình thường' });
            await userRole.save();
        }

        // Đọc dữ liệu từ file users.txt
        const data = fs.readFileSync('users.txt', 'utf8');
        const lines = data.split('\n');

        // Bỏ qua dòng tiêu đề
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const [username, email] = line.split('\t');
            
            if (username && email) {
                // Kiểm tra xem user này đã tồn tại trong DB chưa
                const existingUser = await User.findOne({ 
                    $or: [{ username: username }, { email: email }]
                });

                if (existingUser) {
                    console.log(`Bỏ qua user ${username} - ${email} vì đã tồn tại.`);
                    continue;
                }

                // Sinh mật khẩu 16 kí tự ngẫu nhiên
                const password = generateRandomPassword();
                
                // Tạo user document mới
                const newUser = new User({
                    username: username,
                    email: email,
                    password: password, // Pre-save hook trong schema sẽ tự băm nó thành bcrypt
                    role: userRole._id
                });

                // Lưu vào database
                await newUser.save();
                console.log(`Đã tạo user thành công vào DB: ${username} - ${email}`);

                // Gửi email báo password cho user sử dụng mailtrap
                await emailConfig.sendUserCredentials(email, username, password);
            }
        }

        console.log("Quá trình import hoàn tất!");

    } catch (error) {
        console.error("Đã xảy ra lỗi trong quá trình import:", error);
    } finally {
        // Đóng kết nối
        mongoose.connection.close();
    }
}

// Chạy script
importUsers();
