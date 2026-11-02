
const express = require('express');

const {
    findVehicleByPlate,
    addVehicle,
    removeVehicle,
    getAllVehicles
} = require('./data/vehicles');

const {
    addHistory,
    getAllHistory,
    findHistoryByPlate
} = require('./data/parkingHistory');

const app = express();
const PORT = 3000;

app.use(express.json());

// Kiem tra server
app.get('/', (req, res) => {
    res.send('Smart Parking Management Backend is running!');
});

// Kiem tra API
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Smart Parking API is working'
    });
});

// Lay danh sach xe dang gui
app.get('/api/vehicles', (req, res) => {
    res.json({
        success: true,
        total: getAllVehicles().length,
        data: getAllVehicles()
    });
});

// Ghi nhan xe vao bai
app.post('/api/vehicles/entry', (req, res) => {
    const { plate } = req.body;

    if (typeof plate !== 'string' || !plate.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Vui long nhap bien so xe'
        });
    }

    const normalizedPlate = plate.trim().toUpperCase();

    if (findVehicleByPlate(normalizedPlate)) {
        return res.status(409).json({
            success: false,
            message: 'Xe nay da co trong bai'
        });
    }

    const vehicle = {
        plate: normalizedPlate,
        entryTime: new Date()
    };

    addVehicle(vehicle);

    res.status(201).json({
        success: true,
        message: 'Ghi nhan xe vao bai thanh cong',
        data: vehicle
    });
});

// Ghi nhan xe ra va tinh phi
app.post('/api/vehicles/exit', (req, res) => {
    const { plate } = req.body;

    if (typeof plate !== 'string' || !plate.trim()) {
        return res.status(400).json({
            success: false,
            message: 'Vui long nhap bien so xe'
        });
    }

    const normalizedPlate = plate.trim().toUpperCase();

    const vehicle = findVehicleByPlate(normalizedPlate);

    if (!vehicle) {
        return res.status(404).json({
            success: false,
            message: 'Khong tim thay xe trong bai'
        });
    }

    const exitTime = new Date();
    const entryTime = new Date(vehicle.entryTime);

    const durationMs = exitTime - entryTime;
    const durationMinutes = Math.ceil(durationMs / (1000 * 60));
    const durationHours = Math.ceil(durationMinutes / 60);

    const fee = durationHours <= 2
        ? 5000
        : 5000 + (durationHours - 2) * 10000;

    const historyRecord = {
        plate: normalizedPlate,
        entryTime: vehicle.entryTime,
        exitTime: exitTime,
        durationMinutes: durationMinutes,
        fee: fee
    };

    addHistory(historyRecord);
    removeVehicle(normalizedPlate);

    res.json({
        success: true,
        message: 'Xe da ra bai thanh cong',
        data: historyRecord
    });
});

// Lay toan bo lich su gui xe
app.get('/api/vehicles/history', (req, res) => {
    res.json({
        success: true,
        total: getAllHistory().length,
        data: getAllHistory()
    });
});

// Tim lich su theo bien so
app.get('/api/vehicles/history/:plate', (req, res) => {
    const plate = req.params.plate.trim().toUpperCase();

    const history = findHistoryByPlate(plate);

    res.json({
        success: true,
        total: history.length,
        data: history
    });
});

// Khoi dong server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
