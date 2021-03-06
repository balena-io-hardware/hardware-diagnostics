import * as fs from 'fs';
import * as path from 'path';
import * as process from 'child_process'

import { Request, Response } from 'express'
import * as express from 'express';

import { DiagHistory } from '../services/DiagResult'
import * as drivesSocket from '../sockets/drives'

let runningProcess = {};
var router = express.Router();

const broadcastToSockets = (message: string) => {
  [...drivesSocket.clients.keys()].forEach(client => {
    client.send(message);
  })
}

/* GET /dev/sd[a-z] drives and /dev/disk/by-path */
router.get('/', async (req: Request, res:Response) => {
  try {
    const drives = fs.readdirSync("/dev/disk/by-path")
      .filter(f => f.indexOf('usb') > -1 && f.indexOf("scsi") > -1)
      .map(m => { 
        return { path: m, device: fs.readlinkSync(`/dev/disk/by-path/${m}`).split("/")[2] } 
      })
      .filter(d => d.device.length === 3) // no partitions /sda1 /sda2 ... 
      
    res.json(drives);
  } catch (err){
    res.status(501).send(err)
  }
});

router.post('/sdk', async (req: Request, res: Response) => {
  const {
    devices,
    size,
    numBuffers
  } = req.body;

  try {
    const sdkRun = process.spawn(
      'node', 
      [ 
        path.join(__dirname, '..', 'services', 'child-tester.js'),      
        devices.join(":"),
        size || 250 * 1024 * 1024,
        numBuffers || 600
      ]
    )

    if (sdkRun.pid) {
      runningProcess[sdkRun.pid] = sdkRun
    }  else {
      res.status(501).send("Unable to spawn sdk write")
      return
    }
  
    sdkRun.on('exit', () => {
      const processIds = Object.keys(runningProcess)
      if (processIds.length !== 0) { // when canceled the exit should not say done
        broadcastToSockets('done sdk')
        
        processIds.forEach(v => {
          delete runningProcess[v];
        })
        
        try {
          DiagHistory
          .createDrivesResult
          .withData(fs.readFileSync(path.join(__dirname, '..', 'last_sdk_result.json'), 'utf8'))
          .persist()
  
        } catch (err) {
          console.error(err)
        }
      }
    })

    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res.status(501).send(err)
  }

})

router.post('/fio', async (req: Request, res: Response) => {
  const { 
    devices, 
    rw, 
    direct, 
    bs,
    runtime, 
    numjobs, 
    name, 
    size,
    io_size,
    ioengine,
    iodepth,
    fsync,
    invalidate,
    overwrite,
    output_format
  } = req.body;

  if (!devices || !devices.length || devices.some(v => v.indexOf('sd') < 0)) {
    console.log("No device specified (eg. `/dev/sda`). Do not run `fio` on system drive.")
    res.sendStatus(403);
    return;
  }

  const fileName = devices.join(":");
  const outputpath = path.join(__dirname, 'last_fio_result.json');

  let parameters = [
    `--filename=${fileName}`,
    `--direct=${direct || 0}`,
    `--rw=${rw || "write"}`,
    `--bs=${bs || "1024k"}`,
    `--runtime=${runtime || 20}`,
    '--time_based',
    `--numjobs=${numjobs || 1}`,
    `--name=${name || `etcher_test_${new Date(Date.now()).toISOString()}`}`,
    `--size=${size || '500m'}`,
    `--io_size=${io_size || "10g"}`,
    `--ioengine=${ioengine || "libaio"}`,
    `--iodepth=${iodepth || 32}`,
    `--fsync=${fsync || 64}`,
    `--invalidate=${invalidate || 0}`,
    `--overwrite=${overwrite || 0}`,
    '--group_reporting',
    `--output=${outputpath}`,
    `--output-format=${output_format || "json"}`
  ]

  console.log("fio", fileName)

  let fioRun = process.spawn('fio', parameters);
  if (fioRun.pid) {
    runningProcess[fioRun.pid] = fioRun
  }  else {
    res.status(501).send("Unable to spawn fio")
    return
  }

  fioRun.on('exit', () => {
    const processIds = Object.keys(runningProcess)
    if (processIds.length !== 0) { // when canceled the exit should not say done
      broadcastToSockets('done')
      
      processIds.forEach(v => {
        delete runningProcess[v];
      })
      
      try {
        DiagHistory
        .createDrivesResult
        .withData(fs.readFileSync(path.join(__dirname, 'last_fio_result.json'), 'utf8'))
        .persist()

      } catch (err) {
        console.error(err)
      }
    }
  })
  
  res.sendStatus(201)
})

router.get('/cancel', (req: Request, res: Response) => {
  broadcastToSockets('cancel')
  
  try {
    Object
      .keys(runningProcess)
      .forEach((v) => { 
        if (!runningProcess[v].kill('SIGKILL')) { throw new Error("Can't kill process") }
        delete runningProcess[v]
      })
  } catch (error) {
    console.log(error);
    res.status(403).send(error);
    return;
  }

  res.status(204).send()
})

router.get('/sdk/last', async (_: Request, res: Response) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, '..', 'last_sdk_result.json'), 'utf8')
    res.send(data)
  } catch (err) {
    console.error(err)
    res.sendStatus(501);
  }
})

router.get('/fio/last', async (_: Request, res: Response) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'last_fio_result.json'), 'utf8')
    res.json(JSON.parse(data))
  } catch (err) {
    console.error(err)
    res.sendStatus(501);
  }
})

module.exports = router;
