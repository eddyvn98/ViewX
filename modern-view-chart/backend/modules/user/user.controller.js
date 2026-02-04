import Users, { userModel } from "../../model/user.js";
import CryptoJS from "crypto-js";
import jwt from "jsonwebtoken";

/**
 * Lấy ra danh sách user
 * @param {*} req
 * @param {*} res
 * @returns
 */
export const getListUsers = async (req, res) => {
  try {
    const userList = await Users.find({});
    res.status(200).json({ success: true, data: userList });
  } catch (error) {
    return res.status(500).json({ error: "Đã xảy ra lỗi" });
  }
};

/**
 * Tạo user mới (Register)
 * @param {*} req
 * @param {*} res
 * @returns
 */
export const createUser = async (req, res) => {
  const username = req.body.email;
  const password = req.body.password;
  try {
    const existingAccount = await Users.findOne({
      username: username,
    });

    if (existingAccount) {
      return res.status(400).json({ error: "Tài khoản đã tồn tại" });
    }

    const encryptedPassword = CryptoJS.AES.encrypt(
      password,
      process.env.KEY_CRYPTO
    ).toString();

    const newUser = await Users.create({
      username,
      encryptedPassword,
    });

    return res.status(201).json({ message: "Tài khoản đã được tạo" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Đã xảy ra lỗi" });
  }
};

/**
 * Xóa user
 * @param {*} req
 * @param {*} res
 * @returns
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.body;
    const deleteUser = Users.deleteOne({
      _id: id,
    });
    if (deleteUser) {
      res
        .status(200)
        .json({ success: true, message: "User updated successful" });
    } else {
      res.status(200).json({ success: false, message: "User updated failed" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Đã xảy ra lỗi" });
  }
};

/**
 * Login user
 * @param {*} req
 * @param {*} res
 */
export const login = async (req, res) => {
  const username = req.body.email;
  const inputPassword = req.body.password;
  try {
    const user = await Users.findOne({
      username,
    });

    if (user) {
      const HashPassword = CryptoJS.AES.decrypt(
        user.password,
        process.env.KEY_CRYPTO
      );
      const password = HashPassword.toString(CryptoJS.enc.Utf8);
      if (inputPassword === password) {
        const token = jwt.sign(
          { _id: user._id, role: user.role },
          process.env.JWT
        );
        res.cookie("token", token, { httpOnly: true });
        res.json({
          message: "Login successfully !!!",
          token: token,
          user: {
            _id: user._id,
            username: user.username,
            role: user.role,
          },
        });
      } else {
        res.status(404).json({ error: "Tài khoản không tồn tại" });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Đã xảy ra lỗi" });
  }
};

/**
 * Đổi password
 * @param {*} req
 * @param {*} res
 * @returns
 */
export const updatePassword = async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    const user = await Users.findOne({
      _id: userId,
    });
    const encryptedPassword = CryptoJS.AES.encrypt(
      newPassword,
      process.env.KEY_CRYPTO
    ).toString();
    user.password = encryptedPassword;

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = await user.save();

    res
      .status(200)
      .json({ message: "Change password successfully", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
