const parkingHistory = [];

function addHistory(record) {
    parkingHistory.push(record);
}

function getAllHistory() {
    return parkingHistory;
}

function findHistoryByPlate(plate) {
    return parkingHistory.filter(
        record => record.plate === plate
    );
}

module.exports = {
    addHistory,
    getAllHistory,
    findHistoryByPlate
};