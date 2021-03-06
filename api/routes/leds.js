var express = require('express');
var router = express.Router();

const fs = require('fs');
const leds = require('sys-class-rgb-led')

/* GET leds */
router.get('/', (req, res, next) => {
  try {
    let leds = fs.readdirSync('/sys/class/leds');
    res.json([...leds]);
  } catch {
    res.sendStatus(501);
  }
});

// color intensity from 1 to 99
router.put('/:name/:color', async (req, res, next) => {
  const { name, color } = req.params;
  let led = new leds.RGBLed([
    `${name}`,
    `${name}`,
    `${name}`
  ])
  
  try {
    const intensity = parseInt(color) / 100
    const ledColor = [intensity,intensity,intensity]
    await led.setColor(ledColor)
    await led.close()
    res.sendStatus(200);
  } catch (error) {    
    res.sendStatus(501)
  }
})

router.post('/all/:color', async (req, res, next) => {
  const { color } = req.params;
  const { names, separator, rString, gString, bString } = req.body;

  let ledStrip = names.map(n => new leds.RGBLed([
    `${n}${separator}${rString}`,
    `${n}${separator}${gString}`,
    `${n}${separator}${bString}`
  ]));

  const ledColor = color.split("-").map(c => parseInt(c) / 100) 

  try {
    for (let ledC of ledStrip) {
      await ledC.setColor(ledColor)
      await ledC.close()
    }
  } catch (error) {
    console.log(error)
  }

  res.send();
})



module.exports = router;
