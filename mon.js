const smi = require('node-nvidia-smi');
const mqtt = require('mqtt').connect('mqtt://docker.vvm.space');
const exec = require('child_process').exec;

var off = 0;
var on = 0;

var start = Date.now();

var lastToggle = Date.now();


var activeTicks = 0;
var inactiveTicks = 0;

var maxUp = 0;
var maxTemp = 0;

var toMine = 'eth';

const isRunning = (query) => {
    let platform = process.platform;
    let cmd = '';
    switch (platform) {
        case 'win32' : cmd = `tasklist`; break;
        case 'darwin' : cmd = `ps -ax | grep ${query}`; break;
        case 'linux' : cmd = `ps -A`; break;
        default: break;
    }
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.log(err);
                return reject(err);
            }
            return resolve(stdout.toLowerCase().indexOf(query.toLowerCase()) > -1);
        });
    })
}

const getTemp = () => {
    return new Promise((resolve, reject) => {
        smi((err, data) => {
            if (err) {
                console.log(err);
                return reject(err);
            }
            resolve(parseFloat(`${data.nvidia_smi_log?.gpu?.temperature?.gpu_temp}`.split(' ')[0]));
        })
    })
}

const powerOff = () => {
    lastToggle = Date.now();
    off++;
    exec('pkill miner');
} 


const powerOn = () => {
        lastToggle = Date.now();
        on++;
        let mr = Math.floor(3 * Math.random());
        console.log(mr);
        toMine = (mr == 2) ? 'ravencoin' : 'eth';
        // mqtt.publish(`${prefix}/mine`, 'eth');
        exec(`cd /home/vvm/mon && ./mine_eth.sh`);
}

const fmt = ms => new Date(ms).toISOString().slice(11,19);
console.log('tick');

const prefix = 'vvma/gpu/0';
(async () => {
console.log('tick');
//    await new Promise((resolve) => mqtt.on('connect', resolve));
//    await new Promise((resolve) => mqtt.subscribe('vvma/gpu/0/temp', resolve));

setInterval(async () => {

console.log('tick');

    const running = Date.now() - start;
    const toggled = Date.now() - lastToggle;

    const active = await isRunning('miner');
    if (active) {
        activeTicks++;
    } else {
        inactiveTicks++;
    }

    const temp = await getTemp();
    const t24 = Math.floor(Date.now() / 60 / 60 / 1000 + 5) % 24;

    // mqtt.publish(`${prefix}/temp`, temp + '');

    const powerOffTemp = 76;

    if (active && (temp > powerOffTemp)) {
        powerOff();
    }
    if (!active && (temp < 49)) {
        powerOn();
    }

    // if (active && (toggled > 3 * 60 * 60 * 1000)) {
    //     powerOff();
    // }

    maxUp = active && (toggled > maxUp) && toggled || maxUp;
    maxTemp = (temp > maxTemp) && temp || maxTemp;

    const uptime = active && (Math.round( (activeTicks / (activeTicks + inactiveTicks)) * 100 * 100) / 100) || 0;
    //mqtt.publish(`${prefix}/uptime`, uptime + '');
    //mqtt.publish(`${prefix}/toggled`, Math.floor(toggled / 1000) + '');
    //mqtt.publish(`${prefix}/active`, active && '1' || '0');
    //mqtt.publish(`${prefix}/reverse`, `${powerOffTemp - temp}`);
    //mqtt.publish(`${prefix}/overtime`,  (active && ((maxUp - toggled) > 0)) && (((maxUp - toggled) / ((maxUp > 0) && maxUp || 1)) + '') || '0');


    console.clear();

    console.log(`Running: ${fmt(running)} (${toMine})`);
    console.log(`Since last toggle: ${fmt(toggled)} (${fmt(maxUp)})`);
    console.log(`Active: ${active} ${uptime}`)
    console.log(`Temp: ${temp} (${maxTemp} max)`)
    console.log(`Power ons: ${on}`)
    console.log(`Power offs: ${off}`)
    console.log( { t24, powerOffTemp });

}, 1000);
})();
