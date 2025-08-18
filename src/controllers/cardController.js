const asyncHandler = require('express-async-handler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { models } = require('./../models/z-index');

exports.getCards = asyncHandler(async (req, res) => {
    let cards = await models.ScannedCards.find({ userId: req.user.id });
    return successResponse(res, cards, 200);
});

exports.saveCard = asyncHandler(async (req, res) => {
    let data = req.body;
    data.userId = req.user.id;
    let card = new models.ScannedCards(data);
    let result = await card.save();
    return successResponse(res, result, 200);
});

exports.deleteCard = asyncHandler(async (req, res) => {
    let { id } = req.body;
    await models.ScannedCards.findByIdAndDelete(id);
    return successResponse(res, true, 200);
});