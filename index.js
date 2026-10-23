const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const CUSTOM_OBJECT_TYPE_ID = '2-21126806';
const CUSTOM_OBJECT_PROPERTIES = ['name', 'cuenta', 'producto'];

app.set('view engine', 'pug');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function renderError(res, error, message) {
    const status = error.response ? 502 : 500;
    const hubSpotMessage = error.response?.data?.message;
    console.error('HubSpot request failed:', {
        status: error.response?.status,
        message: hubSpotMessage || error.message
    });
    res.status(status).render('error', {
        title: 'HubSpot API Error | Integrating With HubSpot I Practicum',
        message
    });
}

function getHubSpotClient() {
    const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('HUBSPOT_ACCESS_TOKEN is not set in the environment');
    }

    return axios.create({
        baseURL: 'https://api.hubapi.com',
        timeout: 10000,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
}

app.get('/', async (req, res) => {
    try {
        const hubspot = getHubSpotClient();
        const data = [];
        let after;

        do {
            const response = await hubspot.get(`/crm/v3/objects/${CUSTOM_OBJECT_TYPE_ID}`, {
                params: {
                    limit: 100,
                    properties: CUSTOM_OBJECT_PROPERTIES.join(','),
                    ...(after ? { after } : {})
                }
            });
            data.push(...response.data.results);
            after = response.data.paging?.next?.after;
        } while (after);

        res.render('homepage', {
            title: 'Adopciones | Integrating With HubSpot I Practicum',
            data
        });
    } catch (error) {
        renderError(res, error, 'No se pudieron cargar los registros de Adopciones.');
    }
});

app.get('/update-cobj', (req, res) => {
    res.render('updates', {
        title: 'Update Custom Object Form | Integrating With HubSpot I Practicum'
    });
});

app.post('/update-cobj', async (req, res) => {
    const properties = Object.fromEntries(
        CUSTOM_OBJECT_PROPERTIES.map((property) => [
            property,
            typeof req.body[property] === 'string' ? req.body[property].trim() : ''
        ])
    );
    const missingProperties = Object.entries(properties)
        .filter(([, value]) => !value)
        .map(([property]) => property);

    if (missingProperties.length > 0) {
        return res.status(400).render('updates', {
            title: 'Update Custom Object Form | Integrating With HubSpot I Practicum',
            error: `Completa todos los campos: ${missingProperties.join(', ')}.`,
            values: properties
        });
    }

    try {
        await getHubSpotClient().post(`/crm/v3/objects/${CUSTOM_OBJECT_TYPE_ID}`, {
            properties
        });
        res.redirect('/');
    } catch (error) {
        renderError(res, error, 'No se pudo crear el registro de Adopciones.');
    }
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
