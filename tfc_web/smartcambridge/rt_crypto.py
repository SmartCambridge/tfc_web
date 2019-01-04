from Crypto.Cipher import AES
import base64
import sys
import os
from datetime import datetime, date, timedelta, timezone
from django.conf import settings

# AES 'pad' byte array to multiple of BLOCK_SIZE bytes
def pad(byte_array):
    BLOCK_SIZE = 16
    pad_len = BLOCK_SIZE - len(byte_array) % BLOCK_SIZE
    return byte_array + (bytes([pad_len]) * pad_len)

# Remove padding at end of byte array
def unpad(byte_array):
    last_byte = byte_array[-1]
    return byte_array[0:-last_byte]

def encrypt(key, message):
    """
    Input String, return base64 encoded encrypted String
    """

    byte_array = message.encode("UTF-8")

    padded = pad(byte_array)

    # generate a random iv and prepend that to the encrypted result.
    # The recipient then needs to unpack the iv and use it.
    iv = os.urandom(AES.block_size)
    cipher = AES.new( key.encode("UTF-8"), AES.MODE_CBC, iv )
    encrypted = cipher.encrypt(padded)
    # Note we PREPEND the unencrypted iv to the encrypted message
    return base64.b64encode(iv+encrypted).decode("UTF-8")

def decrypt(key, message):
    """
    Input encrypted bytes, return decrypted bytes, using iv and key
    """

    byte_array = base64.b64decode(message)

    iv = byte_array[0:16] # extract the 16-byte initialization vector

    messagebytes = byte_array[16:] # encrypted message is the bit after the iv

    cipher = AES.new(key.encode("UTF-8"), AES.MODE_CBC, iv )

    decrypted_padded = cipher.decrypt(messagebytes)

    decrypted = unpad(decrypted_padded)

    return decrypted.decode("UTF-8");

# Make an rt_token with defaults limiting to smartcambridge
# issuer: any string (typically reverse(view-id)) identifying requestor of this token
# token_params: any params given to override the defaults
def rt_token(issuer, token_params):
    """
    Return an encrypted rt_token, created from argument dictionary with defaults for
    duration (1 hour), origin (smartcambridge servers) and uses (10000)
    """
    issued_datetime = datetime.now(timezone.utc)

    # default duration to 1 hour
    duration = token_params.get("duration", timedelta(hours=1))

    expires_datetime = issued_datetime + duration

    issued = issued_datetime.isoformat()
    expires = expires_datetime.isoformat()

    # default origin to smartcambridge servers
    origin = token_params.get("origin", '[ "https://tfc-app[1-5].cl.cam.ac.uk", "https://smartcambridge.org", "https://www.smartcambridge.org" ]')

    # default to 10000 uses limit
    uses = token_params.get("uses", "10000")

    # Create final token as a String for encryption
    token = '{\n'
    token += ' "issuer": "'+issuer+'",\n'
    token += ' "issued": "'+issued+'",\n'
    token += ' "expires": "'+expires+'",\n'
    token += ' "origin": '+origin+',\n'
    token += ' "uses" : "'+uses+'"\n'
    token += '}\n'
    return encrypt(settings.RTMONITOR_KEY, token)

