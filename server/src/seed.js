const { load, save, nextId } = require('./db');

function seed() {
  const db = load();
  if (db.users.length) {
    console.log('已有数据，跳过种子。如需重置请删除 server/src/data/db.json');
    return;
  }

  // 角色用户
  const admin = {
    id: nextId('u'),
    openid: 'seed_admin',
    username: 'admin',
    password: 'admin123',
    nickname: '超级管理员',
    avatar: '',
    phone: '13800000000',
    createdAt: new Date().toISOString(),
  };
  const staff = {
    id: nextId('u'),
    openid: 'seed_staff',
    username: 'staff01',
    password: 'staff123',
    nickname: '东区团长·王姐',
    avatar: '',
    phone: '13800000001',
    createdAt: new Date().toISOString(),
  };
  const buyer = {
    id: nextId('u'),
    openid: 'seed_buyer',
    username: 'buyer01',
    password: 'buyer123',
    nickname: '演示用户',
    avatar: '',
    phone: '13800000002',
    createdAt: new Date().toISOString(),
  };
  db.users.push(admin, staff, buyer);
  db.userRoles.push(
    { userId: admin.id, role: 'admin' },
    { userId: admin.id, role: 'buyer' },
    { userId: staff.id, role: 'staff' },
    { userId: staff.id, role: 'buyer' },
    { userId: buyer.id, role: 'buyer' }
  );

  // 自提点
  const pp1 = {
    id: nextId('pp'),
    name: '阳光小区·菜鸟驿站',
    address: '阳光小区 3 号楼东侧 1 层',
    phone: '0571-88880001',
    openTime: '08:30-21:00',
    staffIds: [staff.id],
    status: 'on',
    createdAt: new Date().toISOString(),
  };
  const pp2 = {
    id: nextId('pp'),
    name: '幸福里社区超市',
    address: '幸福里商业街 12 号',
    phone: '0571-88880002',
    openTime: '09:00-22:00',
    staffIds: [],
    status: 'on',
    createdAt: new Date().toISOString(),
  };
  db.pickupPoints.push(pp1, pp2);

  // 分类
  const cats = [
    { id: nextId('cat'), name: '时令水果', icon: '🍎', sort: 10, status: 'on' },
    { id: nextId('cat'), name: '新鲜蔬菜', icon: '🥬', sort: 9, status: 'on' },
    { id: nextId('cat'), name: '肉禽蛋品', icon: '🥚', sort: 8, status: 'on' },
    { id: nextId('cat'), name: '粮油速食', icon: '🍚', sort: 7, status: 'on' },
    { id: nextId('cat'), name: '乳品烘焙', icon: '🥛', sort: 6, status: 'on' },
    { id: nextId('cat'), name: '零食', icon: '🍪', sort: 5, status: 'on' },
    { id: nextId('cat'), name: '饮品', icon: '🧃', sort: 4, status: 'on' },
    { id: nextId('cat'), name: '日用百货', icon: '🧻', sort: 3, status: 'on' },
  ];
  db.categories.push(...cats);

  const cover = (n) =>
    `https://picsum.photos/seed/groupbuy${n}/600/600`;

  function addProduct(opts) {
    const p = {
      id: nextId('p'),
      title: opts.title,
      cover: opts.cover,
      images: [opts.cover, cover(opts.n + 10)],
      detail: opts.detail || opts.title,
      categoryId: opts.categoryId,
      status: 'on',
      saleType: opts.saleType || 'spot',
      pickupOnly: true,
      isHot: !!opts.isHot,
      sort: opts.sort || 0,
      activityPrice: opts.activityPrice ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.products.push(p);
    for (const s of opts.skus) {
      db.productSkus.push({
        id: nextId('sk'),
        productId: p.id,
        name: s.name,
        spec: s.spec || '',
        price: s.price,
        linePrice: s.linePrice || null,
        stock: s.stock,
        image: opts.cover,
        deleted: false,
      });
    }
    return p;
  }

  addProduct({
    n: 1,
    title: '泰国金枕榴莲 3-4斤整果',
    cover: cover(1),
    categoryId: cats[0].id,
    isHot: true,
    saleType: 'presale',
    sort: 100,
    skus: [
      { name: '3-4斤', price: 89.9, linePrice: 129, stock: 50 },
      { name: '5-6斤', price: 139.9, linePrice: 199, stock: 30 },
    ],
  });
  addProduct({
    n: 2,
    title: '山东烟台红富士苹果 5斤装',
    cover: cover(2),
    categoryId: cats[0].id,
    isHot: true,
    saleType: 'spot',
    sort: 90,
    activityPrice: 19.9,
    skus: [{ name: '5斤', price: 29.9, linePrice: 39.9, stock: 200, spec: '中果' }],
  });
  addProduct({
    n: 3,
    title: '海南贵妃芒 3斤',
    cover: cover(3),
    categoryId: cats[0].id,
    saleType: 'presale',
    sort: 80,
    skus: [{ name: '3斤', price: 35.9, stock: 80 }],
  });
  addProduct({
    n: 4,
    title: '有机小油菜 400g',
    cover: cover(4),
    categoryId: cats[1].id,
    saleType: 'spot',
    sort: 70,
    skus: [{ name: '400g', price: 4.9, stock: 300 }],
  });
  addProduct({
    n: 5,
    title: '本地西红柿 2斤',
    cover: cover(5),
    categoryId: cats[1].id,
    saleType: 'spot',
    isHot: true,
    sort: 75,
    skus: [{ name: '2斤', price: 8.9, linePrice: 12.9, stock: 150 }],
  });
  addProduct({
    n: 6,
    title: '土鸡蛋 30枚装',
    cover: cover(6),
    categoryId: cats[2].id,
    saleType: 'spot',
    sort: 65,
    skus: [{ name: '30枚', price: 32.9, stock: 100 }],
  });
  addProduct({
    n: 7,
    title: '鲜牛乳吐司 400g',
    cover: cover(7),
    categoryId: cats[4].id,
    saleType: 'spot',
    sort: 60,
    skus: [{ name: '400g', price: 12.8, stock: 60 }],
  });
  addProduct({
    n: 8,
    title: '五常大米 5kg',
    cover: cover(8),
    categoryId: cats[3].id,
    saleType: 'mixed',
    sort: 55,
    skus: [{ name: '5kg', price: 49.9, linePrice: 69, stock: 80 }],
  });

  // 轮播
  db.banners.push(
    {
      id: nextId('bn'),
      image: cover(90),
      link: '/pages/index/index',
      title: '周末水果节 · 立减 10 元',
      sort: 10,
      status: 'on',
    },
    {
      id: nextId('bn'),
      image: cover(91),
      link: '/pages/category/category',
      title: '次日达自提 · 新鲜看得见',
      sort: 9,
      status: 'on',
    }
  );

  save();
  console.log('种子数据完成');
  console.log('PC 超管: admin / admin123');
  console.log('团长:   staff01 / staff123');
  console.log('买家:   buyer01 / buyer123');
}

if (require.main === module) seed();
module.exports = seed;
