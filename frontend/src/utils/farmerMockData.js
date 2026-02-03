// Mock data for farmer profiles
// This data structure simulates API responses and can be easily replaced with actual API calls

export const farmerProfiles = {
  "farmer-1": {
    id: "farmer-1",
    profile: {
      name: {
        en: "Srey Meng Hong",
        km: "ស្រី ម៉េងហុង"
      },
      phoneNumber: "0967676178",
      profileImage: "https://via.placeholder.com/150"
    },
    cropSafetyScore: {
      score: 9,
      maxScore: 10
    },
    cropInformation: {
      cropType: {
        en: "Bok Choy (Chinese Cabbage)",
        km: "ប៉ិកួៈ (Bok Choy / Chinese Cabbage)"
      },
      farmLocation: {
        en: "Khan Dangkao, Phnom Penh",
        km: "ខណ្ឌដង្កោ រាជធានីភ្នំពេញ"
      },
      plantingDate: {
        en: "January 21, 2026",
        km: "21 មករា 2026"
      },
      harvestDate: {
        en: "January 21, 2027",
        km: "21 មករា 2027"
      }
    },
    cultivationHistory: [
      {
        week: 1,
        weekLabel: {
          en: "Week 1 (January 28, 2026)",
          km: "អាទិត្យទី១ (២៨ មករា ២០២៦)"
        },
        wateringStatus: {
          status: "appropriate",
          label: {
            en: "Appropriate",
            km: "សមស្រប"
          }
        },
        soilNutrientLevel: {
          status: "appropriate",
          label: {
            en: "Appropriate",
            km: "សមស្រប"
          }
        }
      },
      {
        week: 2,
        weekLabel: {
          en: "Week 2 (February 4, 2026)",
          km: "អាទិត្យទី២ (៤ កុម្ភៈ ២០២៦)"
        },
        wateringStatus: {
          status: "pending",
          label: {
            en: "Data entry in progress",
            km: "កំពុងបញ្ចូលទិន្នន័យ"
          }
        },
        soilNutrientLevel: {
          status: "pending",
          label: {
            en: "Pending",
            km: "កំពុងរងចាំ"
          }
        }
      }
    ]
  },
  "farmer-2": {
    id: "farmer-2",
    profile: {
      name: {
        en: "Sok Kimheng",
        km: "សុខ គីមហេង"
      },
      phoneNumber: "0123456789",
      profileImage: "https://via.placeholder.com/150"
    },
    cropSafetyScore: {
      score: 8,
      maxScore: 10
    },
    cropInformation: {
      cropType: {
        en: "Tomato",
        km: "ប៉េងប៉ោះ"
      },
      farmLocation: {
        en: "Khan Meanchey, Phnom Penh",
        km: "ខណ្ឌមានជ័យ រាជធានីភ្នំពេញ"
      },
      plantingDate: {
        en: "January 15, 2026",
        km: "15 មករា 2026"
      },
      harvestDate: {
        en: "April 15, 2026",
        km: "15 មេសា 2026"
      }
    },
    cultivationHistory: [
      {
        week: 1,
        weekLabel: {
          en: "Week 1 (January 22, 2026)",
          km: "អាទិត្យទី១ (២២ មករា ២០២៦)"
        },
        wateringStatus: {
          status: "appropriate",
          label: {
            en: "Appropriate",
            km: "សមស្រប"
          }
        },
        soilNutrientLevel: {
          status: "appropriate",
          label: {
            en: "Appropriate",
            km: "សមស្រប"
          }
        }
      },
      {
        week: 2,
        weekLabel: {
          en: "Week 2 (January 29, 2026)",
          km: "អាទិត្យទី២ (២៩ មករា ២០២៦)"
        },
        wateringStatus: {
          status: "appropriate",
          label: {
            en: "Appropriate",
            km: "សមស្រប"
          }
        },
        soilNutrientLevel: {
          status: "appropriate",
          label: {
            en: "Appropriate",
            km: "សមស្រប"
          }
        }
      }
    ]
  }
};

// Function to simulate API call
export const getFarmerProfile = (farmerId) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const farmerData = farmerProfiles[farmerId];
      if (farmerData) {
        resolve(farmerData);
      } else {
        reject(new Error("Farmer not found"));
      }
    }, 500); // Simulate network delay
  });
};
