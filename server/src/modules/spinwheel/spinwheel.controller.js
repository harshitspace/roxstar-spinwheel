import asyncHandler from '../../utils/asyncHandler.js';
import ApiResponse from '../../utils/ApiResponse.js';
import * as spinWheelService from './spinwheel.service.js';

export const createWheel = asyncHandler(async (req, res) => {
  const wheel = await spinWheelService.createWheel(req.user._id, req.body);
  res.status(201).json(new ApiResponse(201, wheel, 'Spin wheel created successfully.'));
});

export const joinWheel = asyncHandler(async (req, res) => {
  const wheel = await spinWheelService.joinWheel(req.user._id, req.params.id);
  res.status(200).json(new ApiResponse(200, wheel, 'Joined spin wheel successfully.'));
});

export const startWheel = asyncHandler(async (req, res) => {
  const wheel = await spinWheelService.startWheel(req.params.id, req.user._id);
  res.status(200).json(new ApiResponse(200, wheel, 'Spin wheel started.'));
});

export const getWheelStatus = asyncHandler(async (req, res) => {
  const wheel = await spinWheelService.getWheelStatus(req.params.id);
  res.status(200).json(new ApiResponse(200, wheel));
});