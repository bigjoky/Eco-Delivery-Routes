//
//  Item.swift
//  EcoDeliveryRoutesMobile
//
//  Created by Joaquin Arevalo Bueno on 27/2/26.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
