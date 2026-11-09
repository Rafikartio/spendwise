import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { data, flush, uid, createDefaultCategories } from './db.js';

/** Creates demo@spendwise.app / Demo@12345 with ~8 months of realistic data. */
const email = 'demo@spendwise.app';
if (data.users.some((u) => u.email === email)) {
  console.log('Demo user already exists - skipping.');
  process.exit(0);
}

const user = {
  id: uid(),
  name: 'Demo User',
  email,
  passwordHash: bcrypt.hashSync('Demo@12345', 10),
  role: 'user',
  active: true,
  currency: 'USD',
  createdAt: new Date(Date.now() - 200 * 864e5).toISOString(),
  lastLoginAt: new Date().toISOString(),
};
data.users.push(user);
const cats = createDefaultCategories(user.id);
const byName = (n) => cats.find((c) => c.name === n);
byName('Food & Dining').budget = 450;
byName('Transport').budget = 150;
byName('Shopping').budget = 250;
byName('Entertainment').budget = 120;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rnd = (a, b) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const add = (date, type, catName, amount, description) =>
  data.transactions.push({
    id: uid(), userId: user.id, type, amount, date: ymd(date),
    categoryId: byName(catName).id, description, notes: '', createdAt: new Date().toISOString(),
  });

const today = new Date();
for (let m = 7; m >= 0; m--) {
  const first = new Date(today.getFullYear(), today.getMonth() - m, 1);
  const last = m === 0 ? today : new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const at = (day) => new Date(first.getFullYear(), first.getMonth(), Math.min(day, last.getDate()));
  if (at(1) <= today) add(at(1), 'income', 'Salary', 4200, 'Monthly salary');
  if (at(1) <= today) add(at(2), 'expense', 'Housing', 1250, 'Rent');
  if (at(12) <= today && Math.random() > 0.4) add(at(12), 'income', 'Freelance', rnd(250, 900), pick(['Website project', 'Logo design', 'Consulting']));
  if (at(15) <= today) add(at(15), 'expense', 'Utilities', rnd(90, 160), 'Electricity & internet');
  for (let d = 1; d <= last.getDate(); d++) {
    const date = at(d);
    if (Math.random() < 0.55) add(date, 'expense', 'Food & Dining', rnd(6, 48), pick(['Lunch', 'Groceries', 'Coffee & snack', 'Dinner out', 'Takeaway']));
    if (Math.random() < 0.25) add(date, 'expense', 'Transport', rnd(4, 38), pick(['Fuel', 'Uber', 'Metro pass', 'Parking']));
    if (Math.random() < 0.09) add(date, 'expense', 'Shopping', rnd(20, 140), pick(['Clothes', 'Amazon order', 'Home items']));
    if (Math.random() < 0.07) add(date, 'expense', 'Entertainment', rnd(10, 60), pick(['Cinema', 'Streaming', 'Concert', 'Games']));
    if (Math.random() < 0.03) add(date, 'expense', 'Health', rnd(15, 90), pick(['Pharmacy', 'Doctor visit', 'Gym']));
  }
}
flush();
console.log(`Seeded ${data.transactions.length} transactions. Login: ${email} / Demo@12345`);
