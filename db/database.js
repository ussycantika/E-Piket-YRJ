require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL atau SUPABASE_KEY tidak ditemukan di file .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = { supabase };
