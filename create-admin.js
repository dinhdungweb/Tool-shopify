/**
 * Script tạo tài khoản Admin
 * 
 * Cách sử dụng:
 *   node create-admin.js
 * 
 * Hoặc với các biến môi trường:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=your_password node create-admin.js
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function createAdmin() {
    console.log("\n🔐 === TẠO TÀI KHOẢN ADMIN ===\n");

    // Lấy thông tin từ biến môi trường hoặc hỏi người dùng
    let email = process.env.ADMIN_EMAIL;
    let password = process.env.ADMIN_PASSWORD;
    let firstName = process.env.ADMIN_FIRST_NAME || "Admin";
    let lastName = process.env.ADMIN_LAST_NAME || "";

    if (!email) {
        email = await prompt("📧 Email: ");
    }

    if (!email || !email.includes("@")) {
        console.error("❌ Email không hợp lệ!");
        process.exit(1);
    }

    if (!password) {
        password = await prompt("🔑 Password (tối thiểu 8 ký tự): ");
    }

    if (!password || password.length < 8) {
        console.error("❌ Password phải có ít nhất 8 ký tự!");
        process.exit(1);
    }

    try {
        // Kiểm tra xem email đã tồn tại chưa
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            console.log(`\n⚠️  Email "${email}" đã được đăng ký!`);
            const confirm = await prompt("Bạn có muốn cập nhật password? (y/n): ");

            if (confirm.toLowerCase() === "y") {
                const hashedPassword = await hashPassword(password);
                await prisma.user.update({
                    where: { email: email.toLowerCase() },
                    data: { password: hashedPassword },
                });
                console.log("\n✅ Đã cập nhật password thành công!");
            } else {
                console.log("\n❌ Đã hủy.");
            }
            return;
        }

        // Tạo user mới
        const hashedPassword = await hashPassword(password);
        const user = await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                password: hashedPassword,
                firstName: firstName,
                lastName: lastName,
            },
        });

        console.log("\n✅ Tạo tài khoản admin thành công!");
        console.log("━".repeat(40));
        console.log(`📧 Email:      ${user.email}`);
        console.log(`👤 Tên:        ${user.firstName} ${user.lastName || ""}`);
        console.log(`🆔 ID:         ${user.id}`);
        console.log(`📅 Ngày tạo:   ${user.createdAt.toLocaleString("vi-VN")}`);
        console.log("━".repeat(40));
        console.log("\n🔗 Đăng nhập tại: /signin\n");

    } catch (error) {
        console.error("\n❌ Lỗi khi tạo tài khoản:", error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Chạy script
createAdmin();
