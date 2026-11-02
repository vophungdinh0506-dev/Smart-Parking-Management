const vehicles = [];

function findVehicleByPlate(plate) {
    return vehicles.find(
        vehicle => vehicle.plate === plate
    );
}

function addVehicle(vehicle) {
    vehicles.push(vehicle);
}

function removeVehicle(plate) {
    const index = vehicles.findIndex(
        vehicle => vehicle.plate === plate
    );

    if (index !== -1) {
        return vehicles.splice(index, 1)[0];
    }

    return null;
}

function getAllVehicles() {
    return vehicles;
}

module.exports = {
    findVehicleByPlate,
    addVehicle,
    removeVehicle,
    getAllVehicles
};