const asyncHandler = require('express-async-handler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { models } = require('./../models/z-index');
const axios = require('axios');

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

exports.createDigitalCard = asyncHandler(async (req, res) => {
    let { name, emailId, mobileNumber } = req.body;

    //Save Card "Digital Card" Under Super Admin
    const payload = {
        name: String(name).trim(),
        email: emailId || "",
        mobile: mobileNumber,
        businessKeyword: "--",
        originId: "67ca6934c15747af04fff36c",
        countryCode: "91"
    };
    var result = await axios.post(`https://gbscard.itfuturz.in/web/create-account/mobile',`, payload, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (result.data != null) {
        let isVisitor = await models.Visitor.findById(req.user.id);
        if (isVisitor) {
            await models.Visitor.findByIdAndUpdate(req.user.id, { digitalProfile: result.data.path }, { new: true });
            return successResponse(res, true, 200);
        }
        let isExibhitor = await models.Exhibitor.findById(req.user.id);
        if (isExibhitor) {
            await models.Exhibitor.findByIdAndUpdate(req.user.id, { digitalProfile: result.data.path }, { new: true });
            return successResponse(res, true, 200);
        }
        return errorResponse(res, "Unable to update profile!", 500);
    } else {
        return errorResponse(res, "Failed to create digital card!", 500);
    }
});