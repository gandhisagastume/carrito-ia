import heapq

def calculate_astar(grid_state):
    try:
        size = int(grid_state.get("size", 8))
        start = tuple(grid_state.get("start", [0, 0]))
        goal = tuple(grid_state.get("goal", [7, 7]))
        obstacles = set(tuple(o) for o in grid_state.get("obstacles", []))
        initial_orientation = grid_state.get("initial_orientation", "NORTH")
        
        # cell_costs is a dict like {"r,c": cost}
        cell_costs_raw = grid_state.get("cell_costs", {})
        costs = {}
        for k, v in cell_costs_raw.items():
            r, c = map(int, k.split(','))
            costs[(r, c)] = float(v)

        # heuristic function (Manhattan distance)
        def h(node):
            return abs(node[0] - goal[0]) + abs(node[1] - goal[1])

        # Priority queue: (f_score, step_id, current_node, path_so_far, g)
        # step_id is to handle tie-breaking
        open_set = []
        step_counter = 0
        heapq.heappush(open_set, (h(start), step_counter, start, [start], 0))
        
        g_score = {start: 0}
        explored_log = []
        closed_set = set()
        
        success = False
        final_path = []
        
        while open_set:
            f, _, current, path, current_g = heapq.heappop(open_set)
            
            if current in closed_set:
                continue
            closed_set.add(current)
            
            # Log exploration for visualization
            explored_log.append({
                "node": current,
                "g": current_g,
                "h": h(current),
                "f": f,
                "step": len(explored_log) + 1
            })
            
            if current == goal:
                success = True
                final_path = path
                break
            
            # Get neighbors (N, S, E, W)
            r, c = current
            directions = [(-1, 0), (1, 0), (0, -1), (0, 1)] # Up, Down, Left, Right
            
            for dr, dc in directions:
                nr, nc = r + dr, c + dc
                neighbor = (nr, nc)
                
                # Check boundaries and obstacles
                if 0 <= nr < size and 0 <= nc < size and neighbor not in obstacles:
                    cell_cost = costs.get(neighbor, 1.0)
                    tentative_g = current_g + cell_cost
                    
                    if neighbor not in g_score or tentative_g < g_score[neighbor]:
                        g_score[neighbor] = tentative_g
                        f_new = tentative_g + h(neighbor)
                        step_counter += 1
                        heapq.heappush(open_set, (f_new, step_counter, neighbor, path + [neighbor], tentative_g))
                        
        result = {
            "success": success,
            "path": final_path,
            "explored": explored_log,
            "total_cost": g_score.get(goal, 0) if success else 0,
            "instructions": []
        }

        if success:
            result["instructions"] = translate_path_to_instructions(final_path, initial_orientation)

        return result
        
    except Exception as e:
        return {"success": False, "error": str(e)}

def translate_path_to_instructions(path, initial_orientation, cell_size_cm=26):
    if len(path) < 2:
        return []

    instructions = []
    current_facing = initial_orientation

    i = 0
    while i < len(path) - 1:
        current = path[i]
        next_cell = path[i + 1]
        
        dr = next_cell[0] - current[0]
        dc = next_cell[1] - current[1]
        
        # Grid coordinates: row increases downwards, col increases rightwards
        if dr == -1: target_dir = "NORTH"
        elif dr == 1: target_dir = "SOUTH"
        elif dc == 1: target_dir = "EAST"
        else: target_dir = "WEST"
        
        turn_instructions = get_turns(current_facing, target_dir)
        instructions.extend(turn_instructions)
        current_facing = target_dir
        
        # Count consecutive steps in same direction
        steps = 1
        while i + steps < len(path) - 1:
            nxt = path[i + steps]
            nxt2 = path[i + steps + 1]
            dr2 = nxt2[0] - nxt[0]
            dc2 = nxt2[1] - nxt[1]
            if dr2 == dr and dc2 == dc:
                steps += 1
            else:
                break
                
        instructions.append({
            "action": "FORWARD",
            "distance_cm": steps * cell_size_cm,
            "cells": steps
        })
        i += steps
        
    instructions.append({"action": "STOP"})
    return instructions

def get_turns(current, target):
    dirs = ["NORTH", "EAST", "SOUTH", "WEST"]
    if current not in dirs or target not in dirs:
        return []
        
    ci = dirs.index(current)
    ti = dirs.index(target)
    diff = (ti - ci) % 4
    
    if diff == 0: return []
    if diff == 1: return [{"action": "TURN_RIGHT", "degrees": 90}]
    if diff == 3: return [{"action": "TURN_LEFT", "degrees": 90}]
    if diff == 2: return [
        {"action": "TURN_RIGHT", "degrees": 90},
        {"action": "TURN_RIGHT", "degrees": 90}
    ]
