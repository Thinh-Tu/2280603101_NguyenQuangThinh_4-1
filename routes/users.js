var express = require("express");
var router = express.Router();
let { validatedResult, CreateAnUserValidator, ModifyAnUserValidator } = require('../utils/validator')
let userModel = require("../schemas/users");
let userController = require('../controllers/users')
let { CheckLogin, CheckRole } = require('../utils/authHandler')

router.get("/", CheckLogin,CheckRole("ADMIN", "USER"), async function (req, res, next) {
    let users = await userModel
      .find({ isDeleted: false })
    res.send(users);
  });

router.get("/:id", async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email, req.body.role,
      req.body.fullName, req.body.avatarUrl, req.body.status, req.body.loginCount)
    res.send(newItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
    res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

let multer = require('multer');
let upload = multer({ dest: 'uploads/' });
let fs = require('fs');
let crypto = require('crypto');
let roleModel = require('../schemas/roles');
let emailConfig = require('../emailConfig');
let exceljs = require('exceljs');

// Hàm tạo ngẫu nhiên chuỗi 16 kí tự
function generateRandomPassword() {
    return crypto.randomBytes(8).toString('hex');
}

router.post("/import-excel", upload.single('file'), async function (req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).send({ message: "Vui lòng chọn file" });
        }

        let filePath = req.file.path;
        let usersToImport = [];

        if (req.file.originalname.endsWith('.xlsx')) {
            let workbook = new exceljs.Workbook();
            await workbook.xlsx.readFile(filePath);
            let worksheet = workbook.worksheets[0];
            for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
                let row = worksheet.getRow(rowIndex);
                let username = row.getCell(1).text; // Tự động lấy string text
                let email = row.getCell(2).text;    // Tự động giải quyết hyperlink/object

                if (username && email) {
                    // Nếu là dạng hyperlink (mailto:abc@xyz.com) đôi khi exceljs có thể lấy chữ mailto, ta dọn nó đi
                    let cleanEmail = email.replace('mailto:', '').trim();
                    usersToImport.push({ username: username.trim(), email: cleanEmail });
                }
            }
        } else {
            // Xử lý đọc file text (tab separated)
            const data = fs.readFileSync(filePath, 'utf8');
            const lines = data.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const parts = line.split('\t'); // Tách username và email bằng tab
                if (parts.length >= 2) {
                    usersToImport.push({ username: parts[0].trim(), email: parts[1].trim() });
                }
            }
        }

        // Tìm hoặc tạo ROLE 'user'
        let userRole = await roleModel.findOne({ name: 'user' });
        if (!userRole) {
            userRole = new roleModel({ name: 'user', description: 'Người dùng bình thường' });
            await userRole.save();
        }

        let result = [];
        for (let user of usersToImport) {
            let { username, email } = user;
            
            // Bỏ qua nếu user đã tồn tại
            const existingUser = await userModel.findOne({ 
                $or: [{ username: username }, { email: email }]
            });

            if (existingUser) {
                result.push({ username, email, status: "Tài khoản hoặc email đã tồn tại" });
                continue;
            }

            const password = generateRandomPassword();
            const newUser = new userModel({
                username: username,
                email: email,
                password: password, 
                role: userRole._id
            });

            await newUser.save();
            
            try {
                await emailConfig.sendUserCredentials(email, username, password);
                result.push({ username, email, status: "Import thành công, đã gửi email" });
            } catch (mailError) {
                console.error("Lỗi gửi email cho " + email + ": ", mailError.message);
                result.push({ username, email, status: "Import thành công DB, nhưng gửi email thất bại (" + mailError.message + ")" });
            }
        }

        // Xóa file tạm sau khi import xong
        fs.unlinkSync(filePath);
        
        res.send({ message: "Import hoàn tất", details: result });
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

module.exports = router;