def xuat(a ,b):
    s = a.split()
    c = ""
    for i in s[:len(s) - 1]:
        c = c + i[:1].lower()
    return s[-1].lower() + c + "." + b + "@vku.udn.vn" 

a = "Phan Thi My Linh"
b = "22ad"
print(xuat(a, b))