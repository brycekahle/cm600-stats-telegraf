'use strict';

process.on('unhandledRejection', err => { 
  console.error(err);
  process.exit(1);
});

const request = require('superagent');
const cheerio = require('cheerio')

async function go() {
  let res;
  try {
    res = await request.get('http://admin:password@192.168.100.1/DocsisStatus.asp');
  } catch (err) {
    if (err.status === 401) {
      // occassionally router is dumb
      res = await request.get('http://admin:password@192.168.100.1/DocsisStatus.asp');
    } else {
      throw err;
    }
  }

  const $ = cheerio.load(res.text);
  const measurements = [];

  /*
    Acquire Downstream Channel (text) | Acquire Downstream Channel Comment (text) |
    Connectivity State (text) | Connectivity State Comment (text) |
    Boot State (text) | Boot State Comment (text) |
    Configuration File (text) | Configuration File Comment (text) |
    Security (text) | Security Comment (text) |
    Current System Time (text)
  */
  const connected = $('#ConnectivityStateComment').text().trim() === 'Operational';

  // Channel (text) | Lock Status (text) | US Channel Type (text) | Channel ID (text) | Symbol Rate (text) | Frequency (text) | Power (text)
  let upLockedChannels=0;
  $('#usTable tr').slice(1).each(function(i, elem) {
    const u = $('td', this).map((i, el) => $(el).text());
    if (Number(u[3]) === 0) {
      return;
    }
    const locked = u[1] == 'Locked';
    if (locked) {
      upLockedChannels++;
    }    
    const freq = u[5].replace(' Hz', '').trim();
    const rate = u[4].replace(' Ksym/sec', '').trim();
    const power = u[6].replace(' dBmV', '').trim();

    measurements.push(`modem,direction=upstream,lock_status=${u[1]},channel_type=${u[2]},channel_id=${u[3]} locked=${locked ? 'true' : 'false'},locked_val=${locked ? 1 : 0}i,frequency=${freq}i,symbol_rate=${rate}i,power=${power}`);
  });

  // Channel (text) | Lock Status (text) | Modulation (text) | Channel ID (text) | Frequency (text) | Power (text) | SNR (text) | Correctables (text) | Uncorrectables (text)
  let downLockedChannels=0;
  $('#dsTable tr').slice(1).each(function(i, elem) {
    const u = $('td', this).map((i, el) => $(el).text());
    if (Number(u[3]) === 0) {
      return;
    }
    const locked = u[1] == 'Locked';
    if (locked) {
      downLockedChannels++;
    }
    const freq = u[4].replace(' Hz', '').trim();
    const power = u[5].replace(' dBmV', '').trim();
    const snr = u[6].replace(' dB', '').trim();
    
    measurements.push(`modem,direction=downstream,lock_status=${u[1]},modulation=${u[2]},channel_id=${u[3]} locked=${locked ? 'true' : 'false'},locked_val=${locked ? 1 : 0}i,frequency=${freq}i,power=${power},snr=${snr},correctables=${u[7]}i,uncorrectables=${u[8]}i`)
  });
  measurements.push(`modem connected=${connected ? 'true' : 'false'},connected_val=${connected ? 1 : 0}i,upstream_locked_channels=${upLockedChannels}i,downstream_locked_channels=${downLockedChannels}i`);

  console.log(measurements.join('\n'));
}

go();
