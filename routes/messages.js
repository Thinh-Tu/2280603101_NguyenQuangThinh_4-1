let express = require('express');
let router = express.Router();
let messageModel = require('../schemas/messages');
let { CheckLogin } = require('../utils/authHandler');
let multer = require('multer');
let path = require('path');
let mongoose = require('mongoose');

// Cấu hình multer để lưu file upload từ tin nhắn
let storageSetting = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname);
        let filename = Date.now() + '-' + Math.round(Math.random() * 1_000_000_000) + ext;
        cb(null, filename);
    }
});
let upload = multer({ storage: storageSetting });

/**
 * GET /api/v1/messages/
 * Lấy tin nhắn cuối cùng của mỗi user mà user hiện tại đã nhắn tin
 * (bao gồm cả từ user hiện tại gửi đi và user khác gửi đến)
 */
router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;

        // Tìm tất cả các conversation partners (người đã nhắn tin qua lại với currentUser)
        let conversations = await messageModel.aggregate([
            {
                $match: {
                    $or: [
                        { from: new mongoose.Types.ObjectId(currentUserId) },
                        { to: new mongoose.Types.ObjectId(currentUserId) }
                    ]
                }
            },
            {
                // Tạo trường partnerId: nếu from = currentUser thì partner là to, ngược lại là from
                $addFields: {
                    partnerId: {
                        $cond: {
                            if: { $eq: ["$from", new mongoose.Types.ObjectId(currentUserId)] },
                            then: "$to",
                            else: "$from"
                        }
                    }
                }
            },
            {
                // Sắp xếp theo thời gian mới nhất
                $sort: { createdAt: -1 }
            },
            {
                // Nhóm theo partnerId, lấy tin nhắn đầu tiên (mới nhất) của mỗi partner
                $group: {
                    _id: "$partnerId",
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            {
                // Lookup thông tin user partner
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "partner"
                }
            },
            {
                $unwind: "$partner"
            },
            {
                // Lookup thông tin từ người gửi
                $lookup: {
                    from: "users",
                    localField: "lastMessage.from",
                    foreignField: "_id",
                    as: "lastMessage.fromUser"
                }
            },
            {
                $unwind: "$lastMessage.fromUser"
            },
            {
                $project: {
                    _id: 0,
                    partner: {
                        _id: "$partner._id",
                        username: "$partner.username",
                        fullName: "$partner.fullName",
                        avatarUrl: "$partner.avatarUrl"
                    },
                    lastMessage: {
                        _id: "$lastMessage._id",
                        messageContent: "$lastMessage.messageContent",
                        createdAt: "$lastMessage.createdAt",
                        fromUser: {
                            _id: "$lastMessage.fromUser._id",
                            username: "$lastMessage.fromUser.username"
                        }
                    }
                }
            },
            {
                $sort: { "lastMessage.createdAt": -1 }
            }
        ]);

        res.send(conversations);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

/**
 * GET /api/v1/messages/:userID
 * Lấy toàn bộ tin nhắn giữa user hiện tại và userID
 * (from: current → to: userID  và  from: userID → to: current)
 */
router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let otherUserId = req.params.userID;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).send({ message: "userID không hợp lệ" });
        }

        let messages = await messageModel
            .find({
                $or: [
                    { from: currentUserId, to: otherUserId },
                    { from: otherUserId, to: currentUserId }
                ]
            })
            .populate('from', 'username fullName avatarUrl')
            .populate('to', 'username fullName avatarUrl')
            .sort({ createdAt: 1 }); // Sắp xếp từ cũ → mới

        res.send(messages);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

/**
 * POST /api/v1/messages/:userID
 * Gửi tin nhắn đến userID
 * Body (multipart/form-data hoặc application/json):
 *   - file (optional): file đính kèm → type = "file", text = đường dẫn file
 *   - text (optional): nội dung text → type = "text", text = nội dung
 *   - to: userID nhận tin nhắn
 */
router.post('/:userID', CheckLogin, upload.single('file'), async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let toUserId = req.params.userID;

        if (!mongoose.Types.ObjectId.isValid(toUserId)) {
            return res.status(400).send({ message: "userID không hợp lệ" });
        }

        let messageContent;

        if (req.file) {
            // Có file đính kèm → type = "file", text = path dẫn đến file
            messageContent = {
                type: "file",
                text: req.file.path
            };
        } else if (req.body.text) {
            // Tin nhắn text thuần
            messageContent = {
                type: "text",
                text: req.body.text
            };
        } else {
            return res.status(400).send({ message: "Vui lòng cung cấp nội dung tin nhắn (text hoặc file)" });
        }

        let newMessage = new messageModel({
            from: currentUserId,
            to: toUserId,
            messageContent: messageContent
        });

        await newMessage.save();
        await newMessage.populate('from', 'username fullName avatarUrl');
        await newMessage.populate('to', 'username fullName avatarUrl');

        res.status(201).send(newMessage);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
