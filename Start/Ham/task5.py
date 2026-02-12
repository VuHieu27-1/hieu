def cut_cake(a, c, d):
    m = max(a, c, d)
    z = 0
    for i in range(1, m + 1, 1):
        if(a % i == 0 and d % i == 0 and c % i == 0):
            z = i
    return z
    
a, c, d = 1, 2, 3
res = cut_cake(a, c, d)
print(res)

