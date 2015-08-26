/**
 * From http://stackoverflow.com/a/24810639
 *
 * @param backgroundHex {string}
 *
 * @returns {string}
 */
function readableForeground(backgroundHex) {
    rgbval = parseInt(backgroundHex, 16)
    r = rgbval >> 16
    g = (rgbval & 65280) >> 8
    b = rgbval & 255
    brightness = r*0.299 + g*0.587 + b*0.114
    return (brightness > 160) ? "000000" : "ffffff"
}