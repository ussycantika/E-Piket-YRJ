require('dotenv').config();
const { supabase } = require('./database');
const bcrypt = require('bcryptjs');

async function seedSupabase() {
  console.log('🌱 Seeding Supabase database...\n');

  try {
    // Clear existing data (in reverse order of foreign key dependencies)
    await supabase.from('checklist_responses').delete().neq('id', 0);
    await supabase.from('piket_reports').delete().neq('id', 0);
    await supabase.from('checklist_template').delete().neq('id', 0);
    await supabase.from('pos_piket').delete().neq('id', 0);
    await supabase.from('kelompok_piket').delete().neq('id', 0);
    await supabase.from('supervisors').delete().neq('id', 0);

    // 1. Supervisor
    const passwordHash = bcrypt.hashSync('admin123', 10);
    const { error: supErr } = await supabase.from('supervisors').insert([
      { username: 'admin', password_hash: passwordHash, nama: 'Supervisor' }
    ]);
    if (supErr) console.error('Error supervisor:', supErr);
    else console.log('👤 Supervisor created: admin / admin123');

    // Helper for seeding groups
    async function seedKelompok(nama, deskripsi, urutan, posData) {
      const { data: kData, error: kErr } = await supabase
        .from('kelompok_piket')
        .insert([{ nama, deskripsi, urutan }])
        .select();

      if (kErr) {
        console.error(`Error inserting ${nama}:`, kErr);
        return;
      }

      const kelompokId = kData[0].id;
      console.log(`\n📁 ${nama}`);

      for (let posIdx = 0; posIdx < posData.length; posIdx++) {
        const pos = posData[posIdx];
        const { data: pData, error: pErr } = await supabase
          .from('pos_piket')
          .insert([{ kelompok_id: kelompokId, nama: pos.nama, urutan: posIdx + 1 }])
          .select();

        if (pErr) {
          console.error(`Error pos ${pos.nama}:`, pErr);
          continue;
        }

        const posId = pData[0].id;
        console.log(`   📍 ${pos.nama} (${pos.items.length} items)`);

        const checklistRows = pos.items.map((itemText, idx) => ({
          pos_id: posId,
          item_text: itemText,
          urutan: idx + 1
        }));

        const { error: cErr } = await supabase.from('checklist_template').insert(checklistRows);
        if (cErr) console.error(`Error items for ${pos.nama}:`, cErr);
      }
    }

    // PIKET PAGI
    await seedKelompok('PIKET PAGI', 'MULAI JAM 06.30 Piket Pagi dilaksanakan di halaman depan, belakang, dan area lingkungan sekolah.', 1, [
      {
        nama: 'HALAMAN DEPAN TERAS',
        items: [
          'TEPAT WAKTU',
          'PERSONEL LENGKAP',
          'MENYAPA MURID',
          'SERAGAM PETUGAS SESUAI, SEMUA SALING MENGINGATKAN/MEMBANTU',
          'APEL PIKET PAGI SHIFT DAN BURU',
          'ADA PETUGAS KEAMANAN MENGANTAR/MENJEMPUT MURID'
        ]
      },
      {
        nama: 'ABSEND RFID',
        items: [
          'TEPAT WAKTU',
          'PERSONEL LENGKAP',
          'SERAGAM PETUGAS SESUAI',
          'PETUGAS PIKET MENGINGATKAN/MEMBANTU, SEMUA SALING MEMBANTU',
          'APEL PIKET PAGI SHIFT DAN BURU',
          'MENGARAHKAN MURID UNTUK SCAN ABSEND'
        ]
      },
      {
        nama: 'GERBANG BELAKANG',
        items: [
          'ADA PETUGAS PIKET BERJAGA (GURU)',
          'MENYAPA MURID',
          'SERAGAM PETUGAS SESUAI, SEMUA SALING MENGINGATKAN/MEMBANTU',
          'MENGARAHKAN MURID UNTUK SCAN/MENURUNKAN KENDARAAN'
        ]
      },
      {
        nama: 'LANTAI 2',
        items: [
          'TEPAT WAKTU',
          'PERSONEL LENGKAP',
          'SERAGAM PETUGAS SESUAI',
          'PETUGAS PIKET MENGINGATKAN/MEMBANTU, SEMUA SALING MEMBANTU',
          'APEL PIKET PAGI SHIFT DAN BURU'
        ]
      },
      {
        nama: 'LANTAI 3',
        items: [
          'TEPAT WAKTU',
          'PERSONEL LENGKAP',
          'SERAGAM PETUGAS SESUAI',
          'PETUGAS PIKET MENGINGATKAN/MEMBANTU, SEMUA SALING MEMBANTU'
        ]
      },
      {
        nama: 'PARKIR MOTOR',
        items: [
          'TEPAT WAKTU',
          'PERSONEL LENGKAP',
          'SERAGAM PETUGAS SESUAI, SEMUA SALING MENGINGATKAN/MEMBANTU'
        ]
      }
    ]);

    // PIKET BERLANJUT
    await seedKelompok('PIKET BERLANJUT', 'Piket berlanjut untuk monitoring area sekolah sepanjang hari.', 2, [
      {
        nama: 'HALAMAN DEPAN',
        items: [
          'ADA PETUGAS PIKET BERJAGA (GURU)',
          'ADA PETUGAS PIKET SECURITY DAN OS',
          'SERAGAM PETUGAS SESUAI',
          'MENGAWASI PERILAKU MURID DI HALAMAN DEPAN',
          'APEL PIKET BERLANJUT DAN ROLLING',
          'ADA PETUGAS PIKET SHIFT DAN BURU',
          'MENGARAHKAN KEPULANGAN ANAK YANG NAIK KENDARAAN'
        ]
      },
      {
        nama: 'HALAMAN TENGAH DAN BELAKANG',
        items: [
          'ADA PETUGAS PIKET BERJAGA (GURU)',
          'MENGAWASI MURID DI HALAMAN TENGAH DAN BELAKANG',
          'MENGECEK KANTIN, KORIDOR, BELAKANG, DAN SEKITAR'
        ]
      },
      {
        nama: 'KORIDOR LANTAI 2 DEPAN DAN BELAKANG',
        items: [
          'ADA PETUGAS PIKET BERJAGA (GURU)',
          'ADA PETUGAS PIKET SECURITY DAN OS',
          'SERAGAM PETUGAS SESUAI',
          'APEL PIKET BERLANJUT DAN ROLLING',
          'APEL PIKET SECURITY DAN OS'
        ]
      },
      {
        nama: 'KORIDOR LANTAI 3 KANTIN DAN AULA',
        items: [
          'ADA PETUGAS PIKET BERJAGA (GURU)',
          'SERAGAM PETUGAS SESUAI',
          'MENGAWASI AREA KANTIN DAN AULA',
          'APEL PIKET BERLANJUT DAN ROLLING'
        ]
      }
    ]);

    // PIKET SIANG & SHALAT
    await seedKelompok('PIKET SIANG & SHALAT', 'Monitoring kegiatan makan siang dan wudhu.', 3, [
      {
        nama: 'MAKAN SIANG',
        items: [
          'PERSONEL LENGKAP',
          'GURU MENGAWASI MURID SAAT MAKAN',
          'MURID ANTRI DENGAN TERTIB',
          'MURID BERDOA SEBELUM DAN SESUDAH MAKAN',
          'MURID MEMBERSIHKAN AREA MAKAN'
        ]
      },
      {
        nama: 'WUDHU (5 TITIK TOILET)',
        items: [
          'PERSONEL LENGKAP',
          'GURU MENGAWASI MURID SAAT WUDHU',
          'MURID ANTRI DENGAN TERTIB',
          'AIR WUDHU TERSEDIA DI SEMUA TITIK',
          'AREA WUDHU BERSIH DAN TIDAK LICIN'
        ]
      }
    ]);

    // PIKET SHALAT
    await seedKelompok('PIKET SHALAT', 'Monitoring kegiatan shalat Dzuhur dan Ashar.', 4, [
      {
        nama: 'SHALAT DZUHUR',
        items: [
          'PERSONEL LENGKAP',
          'GURU LEBIH AWAL HADIR DI AULA',
          'MURID MENYIMPAN SENDAL DENGAN RAPIH',
          'NASIHAT SEBELUM SHALAT',
          'MURID MEMBAWA BUKU SAKU DOA',
          'GURU MENGIKUTI RANGKAIAN KEGIATAN SAMPAI SELESAI'
        ]
      },
      {
        nama: 'SHALAT ASHAR',
        items: [
          'PERSONEL LENGKAP',
          'GURU LEBIH AWAL HADIR DI AULA',
          'MURID MENYIMPAN SENDAL DENGAN RAPIH',
          'NASIHAT SEBELUM SHALAT',
          'MURID MEMBAWA BUKU SAKU DOA',
          'GURU MENGIKUTI RANGKAIAN KEGIATAN SAMPAI SELESAI'
        ]
      }
    ]);

    // PIKET KEPULANGAN
    await seedKelompok('PIKET KEPULANGAN', 'Monitoring kegiatan kepulangan murid.', 5, [
      {
        nama: 'HALAMAN DEPAN',
        items: [
          'JUMLAH PERSONEL LENGKAP',
          'SERAGAM PETUGAS SESUAI',
          'MENGARAHKAN MURID UNTUK SEGERA PULANG'
        ]
      },
      {
        nama: 'HALAMAN BELAKANG (LAPANGAN SEPAK BOLA)',
        items: [
          'JUMLAH PERSONEL LENGKAP',
          'SERAGAM PETUGAS SESUAI',
          'MENGARAHKAN MURID UNTUK SEGERA PULANG'
        ]
      }
    ]);

    console.log('\n✅ Seeding Supabase selesai!');
  } catch (err) {
    console.error('❌ Error during seeding:', err);
  }
}

seedSupabase();
