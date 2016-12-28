#!/usr/bin/env node --harmony
const program = require('commander');
const storage = require('node-persist');
const prompt = require('prompt');
const fs = require('fs');
const ping = require('ping');
const moment = require('moment');
const exec = require('child_process').exec;
storage.initSync({ ttl: 1000 * 60 * 60 * 24 * 365 });

program
  .command('add')
  .description('Add new user for tracking')
  .option('-v, --verbose')
  .action(() => {
    const schema = {
      properties: {
        username: {
          description: 'username',
          required: true
        },
        mac: {
          description: 'Mac Address',
          required: true
        }
      }
    };

    prompt.message = '';
    prompt.start();
    prompt.get(schema, (err, result) => {
      if (err) { console.log('Error Occured'); return 1; }
      addUser(result.username, result.mac);
      verbose(`${result.username} added with MAC address: ${result.mac}`);
      process.exit(0);
    });

    function addUser(username, mac) {
      const users = storage.getItemSync('users') || {};
      users[username] = mac;
      storage.setItemSync('users', users);
    }
  })

program
  .command('run')
  .option('-v, --verbose')
  .option('-f, --force')
  .description('Runs the script to check who is online specified in log file')
  .action(() => {
    if (!storage.getItemSync('filePath')) {
      verbose(`Log path is not specified, using default path`);
      storage.setItemSync('filePath', `${process.env.HOME}/Desktop/wio.log`);
    }

    const filePath = storage.getItemSync('filePath');
    const logFile = getLogFile();
    const users = storage.getItemSync('users');

    verbose(`Using file at: ${filePath}`);
    if (program.force) {
      verbose('Cleaning arp table');
      exec(`arp -a -d`);
      verbose('Running Angry IP Scan');
      Promise.all(angryIpScan()).then(() => {
        verbose('Angry IP Scan done');
        checkForUsers();
      });
    } else {
      checkForUsers();
    }

    function checkForUsers() {
      const promises = [];

      Object.keys(users).forEach((username) => {
        promises.push(checkForUser(username));
      });

      return Promise.all(promises);
    }

    function checkForUser(username) {
      if (!isMorning()) {
        verbose(`It is not morning current time is: ${moment().format('HH:mm')}`);
        process.exit(1);
      }

      return getIpWithArp(username).then(() => {
        logToFile(username, moment().format('MM-DD-YYYY'), moment().format('HH:mm'));
      }).catch(() => {
        setTimeout(checkForUser.bind(this, username), 1000 * 20);
      });
    }

    function isMorning() {
      return moment().isBetween(moment().hour(08).minute(00), moment().hour(24).minute(00))
    }

    function getIpWithArp(username) {
      return new Promise((resolve, reject) => {
        verbose(`Checking for ${username}`);
        const mac = users[username];
        const arp = exec(`arp -an | grep -i ${mac}`);

        arp.stdout.on('data', (data) => {
          verbose(`Machine with ${mac} address is on local network`);
          verbose(`Extracting IP address`);
          const ip = data.substring(data.indexOf('(') + 1, data.indexOf(')'));

          checkAlive(ip)
            .then(() => { resolve(`it's ALIVE`);})
            .catch(() => { reject('noooo');});
        });

        arp.on('close', (code) => {
          if (code === 1) {
            verbose(`Machine with ${mac} address is not on local network`);

            verbose('Pissed off ip scanning started');
            Promise.all(angryIpScan()).then(() => {
              verbose('Pinging done, retrying');
              reject();
            });
          }
        });
      });
    }

    function checkAlive(ip) {
      verbose(ip);

      return new Promise((resolve, reject) => {
        ping.promise.probe(ip, { timeout: 500, extra: ['-c 1']}).then(({ alive }) => { alive ? resolve() : reject(); });
      });
    }

    function angryIpScan() {
      const promises = [];
      for (let i = 0; i < 256; i++) {
        ip = `192.168.4.${i}`;
        try {
          promises.push(ping.promise.probe(ip, {timeout: 500, extra: ['-c 1']}));
        } catch (e) {
          console.log(`IP: ${ip} failed to ping`);
        };
      }

      return promises;
    }

    function logToFile(username, date, time) {
      verbose(`Logging ${username}`);

      logFile[username] = logFile[username] || {}
      logFile[username][date] = logFile[username][date] || time;

      logString = JSON.stringify(logFile);
      fs.writeFileSync(filePath, logString, 'utf8');
      verbose('Logging completed');
    }

    function getUsers() {
      Object.keys(logFile).forEach((username) => {
        users[username] = logFile[username].mac;
      });

      return users;
    }

    function getLogFile() {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        if (!fileContent.length) {
          fs.writeFileSync(filePath, '{}', 'utf8');
          verbose(`Log file is empty`);
        }

        return JSON.parse(fs.readFileSync(filePath));
      } catch (e) {
        if (!fs.existsSync(filePath)) {
          console.log(`File: ${filePath} cannot be found`);
        } else {
          console.log(`JSON at ${filePath} cannot be parsed`);
        }
        process.exit(1);
      }
    }
  });

program
  .command('log <path>')
  .option('-v, --verbose')
  .description('Sets absolute path to file to be logged')
  .action((path) => {
    storage.setItemSync('filePath', path);
    verbose(`Program path is successfully updated to: ${path}`);
    process.exit(0);
  })

program
  .option('-v, --verbose')
  .option('-f, --force', 'Force AngryIpScan before matching MAC to IP. Requires sudo to flush the arp table')

program
  .usage('[command]')

program.parse(process.argv);

function verbose(text) {
  program.verbose && console.log(text);
}
