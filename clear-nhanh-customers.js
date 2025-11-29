const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearNhanhCustomers() {
  try {
    console.log('🗑️  Bắt đầu xóa dữ liệu Nhanh customers...\n');

    // Đếm số lượng trước khi xóa
    const countBefore = await prisma.nhanhCustomer.count();
    console.log(`📊 Tổng số Nhanh customers hiện tại: ${countBefore}`);

    if (countBefore === 0) {
      console.log('✅ Không có dữ liệu để xóa.');
      return;
    }

    // Xác nhận trước khi xóa
    console.log('\n⚠️  CẢNH BÁO: Bạn sắp xóa TẤT CẢ dữ liệu Nhanh customers!');
    console.log('   Thao tác này KHÔNG THỂ HOÀN TÁC!\n');

    // Xóa tất cả Nhanh customers
    const result = await prisma.nhanhCustomer.deleteMany({});
    
    console.log(`✅ Đã xóa thành công ${result.count} Nhanh customers`);

    // Kiểm tra lại
    const countAfter = await prisma.nhanhCustomer.count();
    console.log(`📊 Số lượng còn lại: ${countAfter}`);

    console.log('\n✨ Hoàn tất!');

  } catch (error) {
    console.error('❌ Lỗi khi xóa dữ liệu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Chạy script
clearNhanhCustomers()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
