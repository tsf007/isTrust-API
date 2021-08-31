import { Router } from 'express'
import https from 'https'
import tls from 'tls'

import {
    InvalidCertificate,
    Owner,
    ValidCertificate,
} from '../types/certificate'

const router = Router()

export default router.get('/', async (req, res, next) => {
    const url = req.query.url as string
    if (!url) return res.sendStatus(400)

    const { host } = new URL(url)

    const request = https.request(
        {
            host,
            port: 443,
            agent: new https.Agent({
                maxCachedSessions: 0,
            }),
            method: 'HEAD',
            rejectUnauthorized: false,
        },
        (response) => {
            const socket = response.socket as tls.TLSSocket

            const valid = socket.authorized

            if (!valid) {
                const authorizationError = socket.authorizationError

                const invalidCertificate: InvalidCertificate = {
                    valid: false,
                    error: authorizationError.toString(),
                }

                res.send(invalidCertificate)
                return
            }

            const cert = socket.getPeerCertificate(false)

            const {
                O: organisation,
                C: country,
                ST: region,
                L: state,
            } = cert.subject

            const owner: Owner = {
                organisation,
                country,
                region,
                state,
            }

            const protocol = socket.getProtocol()
            if (!protocol) return res.sendStatus(500)

            const validCertificate: ValidCertificate = {
                valid: true,
                protocol,
            }
            if (JSON.stringify(owner) !== '{}') {
                validCertificate.owner = owner
            }
            res.send(validCertificate)
        }
    )
    request.on('error', (e) => {
        next(e)
        return
    })
    request.end()
})
